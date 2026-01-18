use crate::features::rate_limit::models::*;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use uuid::Uuid;
use serde_json::json;

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
        self.check_rate_limit_with_endpoint(rule_id, identifier, "").await
    }

    /// Check if request should be rate limited with endpoint info
    /// Returns Ok(()) if allowed, Err with retry_after if limited
    pub async fn check_rate_limit_with_endpoint(&self, rule_id: &str, identifier: &str, endpoint: &str) -> Result<(), u64> {
        // Skip if test mode
        if self.test_mode {
            return Ok(());
        }

        // Get rule from ontology
        let rule = match self.get_rule_ontology(rule_id).await {
            Ok(Some(rule)) => rule,
            _ => return Ok(()), // Rule not found, allow request
        };

        // Skip if rule is disabled
        if !rule.enabled {
            return Ok(());
        }

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

            // Log blocked attempt as ontology entity
            let _ = self.log_attempt_ontology_with_endpoint(rule_id, identifier, endpoint, true).await;

            return Err(retry_after);
        }

        // Record this request
        timestamps.push(now);

        // Log allowed attempt as ontology entity
        let _ = self.log_attempt_ontology_with_endpoint(rule_id, identifier, endpoint, false).await;

        Ok(())
    }

    /// Reset rate limit counters for a specific rule
    pub async fn reset_counters(&self, rule_id: &str) {
        let mut cache = self.cache.write().await;
        cache.retain(|(rid, _), _| rid != rule_id);
    }

    /// Get all rate limit rules
    pub async fn list_rules(&self) -> Result<Vec<RateLimitRule>, sqlx::Error> {
        self.list_rules_ontology().await
    }

    /// Get a single rate limit rule
    pub async fn get_rule(&self, rule_id: &str) -> Result<Option<RateLimitRule>, sqlx::Error> {
        self.get_rule_ontology(rule_id).await
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
        self.verify_bypass_token_ontology(token).await
    }

    /// List all bypass tokens
    pub async fn list_bypass_tokens(&self) -> Result<Vec<BypassToken>, sqlx::Error> {
        self.list_bypass_tokens_ontology().await
    }

    /// Create new bypass token
    pub async fn create_bypass_token(
        &self,
        create: CreateBypassToken,
        created_by: Option<Uuid>,
    ) -> Result<BypassToken, sqlx::Error> {
        self.create_bypass_token_ontology(create, created_by).await
    }



    /// Delete bypass token
    pub async fn delete_bypass_token(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM entities WHERE id = $1 AND class_id = (SELECT id FROM classes WHERE name = 'BypassToken')")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ===== ONTOLOGY-BASED METHODS =====

    /// Get rate limit rule from ontology
    pub async fn get_rule_ontology(&self, rule_name: &str) -> Result<Option<RateLimitRule>, sqlx::Error> {
        let result: Option<(Uuid, serde_json::Value)> = sqlx::query_as(
            r#"
            SELECT e.id, e.attributes
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE c.name = 'RateLimitRule'
            AND e.attributes->>'name' = $1
            LIMIT 1
            "#,
        )
        .bind(rule_name)
        .fetch_optional(&self.pool)
        .await?;

        match result {
            Some((id, attributes)) => {
                // Parse attributes into RateLimitRule
                let name = attributes.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let endpoint_pattern = attributes.get("endpoint_pattern")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let max_requests = attributes.get("max_requests")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);

                let window_seconds = attributes.get("window_seconds")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);

                let strategy = attributes.get("strategy")
                    .and_then(|v| v.as_str())
                    .map(|s| match s {
                        "IP" => RateLimitStrategy::IP,
                        "User" => RateLimitStrategy::User,
                        "Global" => RateLimitStrategy::Global,
                        _ => RateLimitStrategy::IP,
                    })
                    .unwrap_or(RateLimitStrategy::IP);

                let enabled = attributes.get("enabled")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                let rule = RateLimitRule {
                    id,
                    name,
                    endpoint_pattern,
                    max_requests,
                    window_seconds,
                    strategy,
                    enabled,
                    created_at: chrono::Utc::now(), // We don't store this in ontology yet
                    updated_at: chrono::Utc::now(),
                };

                Ok(Some(rule))
            }
            None => Ok(None),
        }
    }

    /// Log rate limit attempt as ontology entity
    pub async fn log_attempt_ontology(
        &self,
        rule_name: &str,
        identifier: &str,
        blocked: bool,
    ) -> Result<(), sqlx::Error> {
        self.log_attempt_ontology_with_endpoint(rule_name, identifier, "", blocked).await
    }

    /// Log rate limit attempt as ontology entity with endpoint info
    pub async fn log_attempt_ontology_with_endpoint(
        &self,
        rule_name: &str,
        identifier: &str,
        endpoint: &str,
        blocked: bool,
    ) -> Result<(), sqlx::Error> {
        // Get RateLimitAttempt class ID
        let class_id: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM classes WHERE name = 'RateLimitAttempt' LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        let class_id = match class_id {
            Some(id) => id,
            None => return Ok(()), // Class doesn't exist yet, skip logging
        };

        let display_name = format!(
            "Rate limit attempt: {} by {} ({})",
            rule_name,
            identifier,
            if blocked { "BLOCKED" } else { "ALLOWED" }
        );

        let attributes = json!({
            "rule_name": rule_name,
            "identifier": identifier,
            "endpoint": endpoint,
            "attempted_at": chrono::Utc::now(),
            "blocked": blocked
        });

        sqlx::query(
            r#"
            INSERT INTO entities (class_id, display_name, attributes)
            VALUES ($1, $2, $3)
            "#,
        )
        .bind(class_id)
        .bind(display_name)
        .bind(attributes)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get all rate limit rules from ontology
    pub async fn list_rules_ontology(&self) -> Result<Vec<RateLimitRule>, sqlx::Error> {
        let results: Vec<(Uuid, serde_json::Value)> = sqlx::query_as(
            r#"
            SELECT e.id, e.attributes
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE c.name = 'RateLimitRule'
            ORDER BY e.attributes->>'name'
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let mut rules = Vec::new();

        for (id, attributes) in results {
            if let Ok(rule) = self.parse_rule_from_attributes(id, &attributes) {
                rules.push(rule);
            }
        }

        Ok(rules)
    }

    /// Verify bypass token from ontology
    pub async fn verify_bypass_token_ontology(&self, token: &str) -> Result<bool, sqlx::Error> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE c.name = 'BypassToken'
            AND e.attributes->>'token' = $1
            AND (e.attributes->>'expires_at' IS NULL
                 OR (e.attributes->>'expires_at')::timestamptz > CURRENT_TIMESTAMP)
            "#,
        )
        .bind(token)
        .fetch_one(&self.pool)
        .await?;

        Ok(count > 0)
    }

    /// List bypass tokens from ontology
    pub async fn list_bypass_tokens_ontology(&self) -> Result<Vec<BypassToken>, sqlx::Error> {
        let results: Vec<(Uuid, serde_json::Value)> = sqlx::query_as(
            r#"
            SELECT e.id, e.attributes
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            WHERE c.name = 'BypassToken'
            ORDER BY e.created_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let mut tokens = Vec::new();

        for (id, attributes) in results {
            if let Ok(token) = self.parse_bypass_token_from_attributes(id, &attributes) {
                tokens.push(token);
            }
        }

        Ok(tokens)
    }

    /// Create bypass token as ontology entity
    pub async fn create_bypass_token_ontology(
        &self,
        create: CreateBypassToken,
        created_by: Option<Uuid>,
    ) -> Result<BypassToken, sqlx::Error> {
        // Get BypassToken class ID
        let class_id: Uuid = sqlx::query_scalar(
            "SELECT id FROM classes WHERE name = 'BypassToken' LIMIT 1"
        )
        .fetch_one(&self.pool)
        .await?;

        let token = format!("{:x}", uuid::Uuid::new_v4().as_u128());

        let display_name = format!(
            "Bypass Token: {}",
            create.description.as_deref().unwrap_or("No description")
        );

        let attributes = json!({
            "token": token,
            "description": create.description,
            "expires_at": create.expires_at,
            "created_by": created_by.map(|id| id.to_string()).unwrap_or_else(|| "system".to_string())
        });

        let entity_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO entities (class_id, display_name, attributes)
            VALUES ($1, $2, $3)
            RETURNING id
            "#,
        )
        .bind(class_id)
        .bind(display_name)
        .bind(attributes)
        .fetch_one(&self.pool)
        .await?;

        // Return the bypass token
        let bypass_token = BypassToken {
            id: entity_id,
            token: token,
            description: create.description,
            created_at: chrono::Utc::now(),
            expires_at: create.expires_at,
            created_by: created_by,
        };

        Ok(bypass_token)
    }

    // ===== HELPER METHODS =====

    fn parse_rule_from_attributes(&self, id: Uuid, attributes: &serde_json::Value) -> Result<RateLimitRule, ()> {
        let name = attributes.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let endpoint_pattern = attributes.get("endpoint_pattern")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let max_requests = attributes.get("max_requests")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let window_seconds = attributes.get("window_seconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let strategy = attributes.get("strategy")
            .and_then(|v| v.as_str())
            .map(|s| match s {
                "IP" => RateLimitStrategy::IP,
                "User" => RateLimitStrategy::User,
                "Global" => RateLimitStrategy::Global,
                _ => RateLimitStrategy::IP,
            })
            .unwrap_or(RateLimitStrategy::IP);

        let enabled = attributes.get("enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(RateLimitRule {
            id,
            name,
            endpoint_pattern,
            max_requests,
            window_seconds,
            strategy,
            enabled,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    fn parse_bypass_token_from_attributes(&self, id: Uuid, attributes: &serde_json::Value) -> Result<BypassToken, ()> {
        let token = attributes.get("token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = attributes.get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let expires_at = attributes.get("expires_at")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let created_by = attributes.get("created_by")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());

        Ok(BypassToken {
            id,
            token,
            description,
            created_at: chrono::Utc::now(),
            expires_at,
            created_by,
        })
    }
}
