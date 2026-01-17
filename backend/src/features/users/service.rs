use crate::features::auth::models::User;
use crate::features::auth::service::AuthError;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct UserService {
    pool: PgPool,
    audit_service: crate::features::system::AuditService,
    ontology_service: crate::features::ontology::service::OntologyService,
}

impl UserService {
    pub fn new(
        pool: PgPool,
        audit_service: crate::features::system::AuditService,
        ontology_service: crate::features::ontology::service::OntologyService,
    ) -> Self {
        Self {
            pool,
            audit_service,
            ontology_service,
        }
    }

    pub async fn find_all(&self) -> Result<Vec<User>, AuthError> {
        let users = sqlx::query_as::<_, User>("SELECT * FROM users")
            .fetch_all(&self.pool)
            .await?;
        Ok(users)
    }

    pub async fn find_by_id(&self, id: &str) -> Result<User, AuthError> {
        let user_uuid = Uuid::parse_str(id).map_err(|_| AuthError::UserNotFound)?;
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(user_uuid)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AuthError::UserNotFound)?;
        Ok(user)
    }

    pub async fn create(
        &self,
        username: &str,
        email: &str,
        password: &str,
        performing_user_id: Option<Uuid>,
    ) -> Result<User, AuthError> {
        let id = Uuid::new_v4();
        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AuthError::PasswordHashError(e.to_string()))?
            .to_string();

        sqlx::query(
            "INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)",
        )
        .bind(id)
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .execute(&self.pool)
        .await?;

        let user = self.find_by_id(&id.to_string()).await?;

        // [DEPRECATED] Technical Debt: Dual-write pattern.
        // We write to both `users` table and Ontology-based `User` entity.
        // Future goal: Migrate fully to Ontology-based auth.

        // Create ontology entity for the user
        if let Ok(user_class) = self.ontology_service.get_system_class("User").await {
            let _ = self
                .ontology_service
                .create_entity(
                    crate::features::ontology::models::CreateEntityInput {
                        class_id: user_class.id,
                        display_name: username.to_string(),
                        parent_entity_id: None,
                        attributes: Some(serde_json::json!({
                            "user_id": id.to_string(),
                            "username": username,
                            "email": email,
                            "last_login_at": null,
                            "last_login_ip": null,
                            "custom_attributes": {}
                        })),
                    },
                    performing_user_id,
                    None,
                )
                .await;
        }

        // Log creation
        // ... (audit log code)
        if let Some(uid) = performing_user_id {
            let _ = self
                .audit_service
                .log(
                    uid,
                    "user.create",
                    "user",
                    Some(id),
                    None,
                    Some(serde_json::to_value(&user).unwrap_or(serde_json::Value::Null)),
                    None,
                )
                .await;
        }

        Ok(user)
    }

    pub async fn update(
        &self,
        id: &str,
        username: Option<String>,
        email: Option<String>,
        performing_user_id: Option<Uuid>,
    ) -> Result<User, AuthError> {
        if username.is_none() && email.is_none() {
            return self.find_by_id(id).await;
        }

        let user_uuid = Uuid::parse_str(id).map_err(|_| AuthError::UserNotFound)?;

        let mut query_builder: sqlx::QueryBuilder<sqlx::Postgres> =
            sqlx::QueryBuilder::new("UPDATE users SET ");
        let mut separated = query_builder.separated(", ");

        if let Some(ref u) = username {
            separated.push("username = ");
            separated.push_bind_unseparated(u);
        }
        if let Some(ref e) = email {
            separated.push("email = ");
            separated.push_bind_unseparated(e);
        }

        query_builder.push(" WHERE id = ");
        query_builder.push_bind(user_uuid);

        query_builder.build().execute(&self.pool).await?;

        let updated_user = self.find_by_id(id).await?;

        // [DEPRECATED] Technical Debt: Dual-write pattern.
        // Syncing explicitly named columns to JSON attributes in Ontology.

        // Sync ontology entity
        if let Ok(user_class) = self.ontology_service.get_system_class("User").await {
            // Find the entity by user_id
            let entity_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM entities WHERE class_id = $1 AND attributes->>'user_id' = $2",
            )
            .bind(user_class.id)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .ok()
            .flatten();

            if let Some(eid) = entity_id {
                let _ = self
                    .ontology_service
                    .update_entity(
                        eid,
                        crate::features::ontology::models::UpdateEntityInput {
                            display_name: username.clone().or(Some(updated_user.username.clone())),
                            parent_entity_id: None,
                            attributes: Some(serde_json::json!({
                                "user_id": id,
                                "username": updated_user.username,
                                "email": updated_user.email,
                                "last_login_at": updated_user.last_login_at,
                                "last_login_ip": updated_user.last_login_ip,
                            })),
                        },
                        performing_user_id,
                    )
                    .await;
            }
        }

        // Log the change
        if let Some(uid) = performing_user_id {
            let _ = self
                .audit_service
                .log(
                    uid,
                    "user.update",
                    "user",
                    Some(updated_user.id),
                    None, // ideally before_state but query-builder doesn't give us that easily without a prior fetch
                    Some(serde_json::to_value(&updated_user).unwrap_or(serde_json::Value::Null)),
                    None,
                )
                .await;
        }

        Ok(updated_user)
    }

    pub async fn delete(
        &self,
        id: &str,
        performing_user_id: Option<Uuid>,
    ) -> Result<(), AuthError> {
        let user_uuid = Uuid::parse_str(id).map_err(|_| AuthError::UserNotFound)?;
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_uuid)
            .execute(&self.pool)
            .await?;

        // Log deletion
        if let Some(uid) = performing_user_id {
            let _ = self
                .audit_service
                .log(
                    uid,
                    "user.delete",
                    "user",
                    Some(user_uuid),
                    None,
                    None,
                    None,
                )
                .await;
        }

        Ok(())
    }
}
