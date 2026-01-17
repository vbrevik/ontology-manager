use rand::Rng;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::models::{ApiKey, CreateApiKeyResponse, WebhookEndpoint};

#[derive(Clone)]
pub struct ApiManagementService {
    pool: PgPool,
}

impl ApiManagementService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_keys(&self) -> Result<Vec<ApiKey>, String> {
        let keys = sqlx::query_as::<_, ApiKey>("SELECT * FROM api_keys ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(keys)
    }

    pub async fn create_key(
        &self,
        name: String,
        scopes: Vec<String>,
    ) -> Result<CreateApiKeyResponse, String> {
        let prefix = format!("pk_live_{}", self.generate_random_string(8));
        let secret_part = self.generate_random_string(32);
        let secret = format!("{}{}", prefix, secret_part);
        let hash = format!("hashed_{}", secret_part); // Placeholder hashing

        let record = sqlx::query(
            r#"
            INSERT INTO api_keys (name, prefix, hash, scopes, status)
            VALUES ($1, $2, $3, $4, 'active')
            RETURNING id, created_at
            "#,
        )
        .bind(&name)
        .bind(&prefix)
        .bind(&hash)
        .bind(&scopes)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(CreateApiKeyResponse {
            id: record.get("id"),
            name,
            prefix,
            secret,
            scopes,
            created_at: record.get("created_at"),
        })
    }

    pub async fn revoke_key(&self, id: Uuid) -> Result<(), String> {
        sqlx::query("UPDATE api_keys SET status = 'revoked' WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn list_webhooks(&self) -> Result<Vec<WebhookEndpoint>, String> {
        let webhooks =
            sqlx::query_as::<_, WebhookEndpoint>("SELECT * FROM webhooks ORDER BY created_at DESC")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| e.to_string())?;

        Ok(webhooks)
    }

    // Helper
    fn generate_random_string(&self, len: usize) -> String {
        const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let mut rng = rand::thread_rng();
        (0..len)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }
}
