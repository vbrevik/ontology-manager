use crate::features::rate_limit::models::*;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use uuid::Uuid;

type RateLimitCache = Arc<RwLock<HashMap<(String, String), Vec<u64>>>>;

#[derive(Clone)]
#[allow(dead_code)]
pub struct RateLimitService {
    pool: PgPool,
    // In-memory cache: key = (rule_id, identifier), value = Vec<timestamp>
    cache: RateLimitCache,
    #[allow(dead_code)]
    test_mode: bool,
}

impl RateLimitService {
    pub fn new(pool: PgPool, test_mode: bool) -> Self {
        Self {
            pool,
            cache: Arc::new(RwLock::new(HashMap::new())),
            test_mode,
        }
    }

    /// Check if request should be rate limited
    /// Returns Ok(()) if allowed, Err with retry_after if limited
    pub async fn check_rate_limit(&self, rule_id: &str, identifier: &str) -> Result<(), u64> {
        // Skip if test mode
        if self.test_mode {
            return Ok(());
        }

        // Get rule from database
        let rule = match self.get_rule(rule_id).await {
            Ok(Some(rule)) if rule.enabled => rule,
            _ => return Ok(()), // Rule not found or disabled, allow request
        };

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let window_start = now.saturating_sub(rule.window_seconds as u64);
        let key = (rule_id.to_string(), identifier.to_string());

        let mut cache = self.cache.write().await;
        let timestamps = cache.entry(key.clone()).or_insert_with(Vec::new);

        // Remove expired timestamps (sliding window)
        timestamps.retain(|&ts| ts > window_start);

        // Check if limit exceeded
        if timestamps.len() as i64 >= rule.max_requests {
            let oldest = timestamps.first().copied().unwrap_or(now);
            let retry_after = (oldest + rule.window_seconds as u64).saturating_sub(now);
            return Err(retry_after);
        }

        // Record this request
        timestamps.push(now);

        Ok(())
    }

    /// Reset rate limit counters for a specific rule
    pub async fn reset_counters(&self, rule_id: &str) {
        let mut cache = self.cache.write().await;
        cache.retain(|(rid, _), _| rid != rule_id);
    }

    /// Get all rate limit rules
    pub async fn list_rules(&self) -> Result<Vec<RateLimitRule>, sqlx::Error> {
        sqlx::query_as::<_, RateLimitRule>("SELECT * FROM rate_limit_rules ORDER BY name")
            .fetch_all(&self.pool)
            .await
    }

    /// Get a single rate limit rule
    pub async fn get_rule(&self, rule_id: &str) -> Result<Option<RateLimitRule>, sqlx::Error> {
        sqlx::query_as::<_, RateLimitRule>("SELECT * FROM rate_limit_rules WHERE id = $1")
            .bind(rule_id)
            .fetch_optional(&self.pool)
            .await
    }

    /// Update a rate limit rule
    pub async fn update_rule(
        &self,
        rule_id: &str,
        update: UpdateRateLimitRule,
    ) -> Result<(), sqlx::Error> {
        let mut query = "UPDATE rate_limit_rules SET updated_at = CURRENT_TIMESTAMP".to_string();
        let mut params: Vec<String> = vec![];
        let mut param_idx = 1;

        if let Some(name) = &update.name {
            query.push_str(&format!(", name = ${}", param_idx));
            params.push(name.clone());
            param_idx += 1;
        }
        if let Some(max_requests) = update.max_requests {
            query.push_str(&format!(", max_requests = ${}", param_idx));
            params.push(max_requests.to_string());
            param_idx += 1;
        }
        if let Some(window_seconds) = update.window_seconds {
            query.push_str(&format!(", window_seconds = ${}", param_idx));
            params.push(window_seconds.to_string());
            param_idx += 1;
        }
        if let Some(enabled) = update.enabled {
            query.push_str(&format!(", enabled = ${}", param_idx));
            params.push((if enabled { "TRUE" } else { "FALSE" }).to_string());
            param_idx += 1;
        }

        query.push_str(&format!(" WHERE id = ${}", param_idx));

        let mut q = sqlx::query(&query);
        for param in params {
            q = q.bind(param);
        }
        q = q.bind(rule_id);

        q.execute(&self.pool).await?;
        Ok(())
    }

    /// Verify bypass token
    pub async fn verify_bypass_token(&self, token: &str) -> Result<bool, sqlx::Error> {
        let result: Option<(i32,)> = sqlx::query_as(
            "SELECT 1 FROM rate_limit_bypass_tokens 
             WHERE token = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.is_some())
    }

    /// List all bypass tokens
    pub async fn list_bypass_tokens(&self) -> Result<Vec<BypassToken>, sqlx::Error> {
        sqlx::query_as::<_, BypassToken>(
            "SELECT * FROM rate_limit_bypass_tokens ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
    }

    /// Create new bypass token
    pub async fn create_bypass_token(
        &self,
        create: CreateBypassToken,
        created_by: Option<Uuid>,
    ) -> Result<BypassToken, sqlx::Error> {
        let token = format!("{:x}", uuid::Uuid::new_v4().as_u128());

        let bypass_token = sqlx::query_as::<_, BypassToken>(
            "INSERT INTO rate_limit_bypass_tokens (token, description, expires_at, created_by)
             VALUES ($1, $2, $3::TIMESTAMPTZ, $4)
             RETURNING *",
        )
        .bind(&token)
        .bind(&create.description)
        .bind(create.expires_at)
        .bind(created_by)
        .fetch_one(&self.pool)
        .await?;

        Ok(bypass_token)
    }

    /// Delete bypass token
    pub async fn delete_bypass_token(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM rate_limit_bypass_tokens WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
