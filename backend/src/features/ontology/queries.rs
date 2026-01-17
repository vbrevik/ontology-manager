use sqlx::PgPool;
use uuid::Uuid;
use serde_json::Value as JsonValue;
use chrono::{DateTime, Utc};

/// Ontology-based user queries
pub struct OntologyUserQueries {
    pool: PgPool,
}

impl OntologyUserQueries {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Get user entity by ID
    pub async fn get_user_by_id(&self, user_id: Uuid) -> Result<OntologyUser, sqlx::Error> {
        sqlx::query_as!(
            OntologyUser,
            r#"
            SELECT 
                e.id,
                e.display_name as username,
                e.attributes->>'email' as "email!",
                e.attributes->>'password_hash' as password_hash,
                e.created_at,
                e.updated_at
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE e.id = $1 AND c.name = 'User' AND e.deleted_at IS NULL
            "#,
            user_id
        )
        .fetch_one(&self.pool)
        .await
    }

    /// Get user by username
    pub async fn get_user_by_username(&self, username: &str) -> Result<OntologyUser, sqlx::Error> {
        sqlx::query_as!(
            OntologyUser,
            r#"
            SELECT 
                e.id,
                e.display_name as username,
                e.attributes->>'email' as "email!",
                e.attributes->>'password_hash' as password_hash,
                e.created_at,
                e.updated_at
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE e.display_name = $1 AND c.name = 'User' AND e.deleted_at IS NULL
            "#,
            username
        )
        .fetch_one(&self.pool)
        .await
    }

    /// Get user by email
    pub async fn get_user_by_email(&self, email: &str) -> Result<OntologyUser, sqlx::Error> {
        sqlx::query_as!(
            OntologyUser,
            r#"
            SELECT 
                e.id,
                e.display_name as username,
                e.attributes->>'email' as "email!",
                e.attributes->>'password_hash' as password_hash,
                e.created_at,
                e.updated_at
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE e.attributes->>'email' = $1 AND c.name = 'User' AND e.deleted_at IS NULL
            "#,
            email
        )
        .fetch_one(&self.pool)
        .await
    }

    /// Get user roles (via has_role relationships)
    pub async fn get_user_roles(&self, user_id: Uuid) -> Result<Vec<OntologyRole>, sqlx::Error> {
        sqlx::query_as!(
            OntologyRole,
            r#"
            SELECT 
                e.id,
                e.display_name as name,
                (e.attributes->>'description') as description,
                (e.attributes->>'level')::int as level
            FROM relationships r
            JOIN relationship_types rt ON r.relationship_type_id = rt.id
            JOIN entities e ON r.target_entity_id = e.id
            JOIN classes c ON e.class_id = c.id
            WHERE r.source_entity_id = $1 
              AND rt.name = 'has_role'
              AND c.name = 'Role'
              AND e.deleted_at IS NULL
            "#,
            user_id
        )
        .fetch_all(&self.pool)
        .await
    }

    /// Count total users
    pub async fn count_users(&self) -> Result<i64, sqlx::Error> {
        let result = sqlx::query!(
            r#"
            SELECT COUNT(*) as "count!"
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE c.name = 'User' AND e.deleted_at IS NULL
            "#
        )
        .fetch_one(&self.pool)
        .await?;
        
        Ok(result.count)
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct OntologyUser {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct OntologyRole {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub level: Option<i32>,
}
