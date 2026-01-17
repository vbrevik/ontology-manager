use super::condition_evaluator::{evaluate_policy_conditions, test_policy_conditions};
use super::policy_models::*;
use chrono::Utc;
use serde_json::Value as JsonValue;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[derive(Debug)]
pub enum PolicyError {
    DatabaseError(String),
    NotFound(String),
    InvalidInput(String),
}

impl std::fmt::Display for PolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            Self::NotFound(msg) => write!(f, "Not found: {}", msg),
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

impl From<sqlx::Error> for PolicyError {
    fn from(err: sqlx::Error) -> Self {
        PolicyError::DatabaseError(err.to_string())
    }
}

#[derive(Clone)]
pub struct PolicyService {
    pool: Pool<Postgres>,
}

impl PolicyService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    // ========================================================================
    // CRUD OPERATIONS
    // ========================================================================

    pub async fn list_policies(&self, active_only: bool) -> Result<Vec<Policy>, PolicyError> {
        let policies = if active_only {
            sqlx::query_as::<_, Policy>(
                "SELECT * FROM policies WHERE is_active = TRUE ORDER BY priority DESC, name",
            )
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Policy>("SELECT * FROM policies ORDER BY priority DESC, name")
                .fetch_all(&self.pool)
                .await?
        };
        Ok(policies)
    }

    pub async fn get_policy(&self, id: Uuid) -> Result<Policy, PolicyError> {
        sqlx::query_as::<_, Policy>("SELECT * FROM policies WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| PolicyError::NotFound("Policy not found".to_string()))
    }

    pub async fn create_policy(
        &self,
        input: CreatePolicyInput,
        created_by: Option<Uuid>,
    ) -> Result<Policy, PolicyError> {
        // Validate effect
        if !["ALLOW", "DENY"].contains(&input.effect.to_uppercase().as_str()) {
            return Err(PolicyError::InvalidInput(
                "Effect must be ALLOW or DENY".to_string(),
            ));
        }

        let policy = sqlx::query_as::<_, Policy>(
            r#"
            INSERT INTO policies 
                (name, description, effect, priority, target_class_id, target_permissions,
                 conditions, scope_entity_id, is_active, valid_from, valid_until, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
            "#,
        )
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.effect.to_uppercase())
        .bind(input.priority.unwrap_or(0))
        .bind(input.target_class_id)
        .bind(&input.target_permissions)
        .bind(&input.conditions)
        .bind(input.scope_entity_id)
        .bind(input.is_active.unwrap_or(true))
        .bind(input.valid_from)
        .bind(input.valid_until)
        .bind(created_by)
        .fetch_one(&self.pool)
        .await?;

        Ok(policy)
    }

    pub async fn update_policy(
        &self,
        id: Uuid,
        input: UpdatePolicyInput,
        updated_by: Option<Uuid>,
    ) -> Result<Policy, PolicyError> {
        let existing = self.get_policy(id).await?;

        let policy = sqlx::query_as::<_, Policy>(
            r#"
            UPDATE policies SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                effect = COALESCE($4, effect),
                priority = COALESCE($5, priority),
                target_class_id = COALESCE($6, target_class_id),
                target_permissions = COALESCE($7, target_permissions),
                conditions = COALESCE($8, conditions),
                scope_entity_id = COALESCE($9, scope_entity_id),
                is_active = COALESCE($10, is_active),
                valid_from = COALESCE($11, valid_from),
                valid_until = COALESCE($12, valid_until),
                updated_at = NOW(),
                updated_by = $13
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.effect.as_ref().map(|e| e.to_uppercase()))
        .bind(input.priority)
        .bind(input.target_class_id.or(existing.target_class_id))
        .bind(&input.target_permissions)
        .bind(&input.conditions)
        .bind(input.scope_entity_id.or(existing.scope_entity_id))
        .bind(input.is_active)
        .bind(input.valid_from)
        .bind(input.valid_until)
        .bind(updated_by)
        .fetch_one(&self.pool)
        .await?;

        Ok(policy)
    }

    pub async fn delete_policy(&self, id: Uuid) -> Result<(), PolicyError> {
        let result = sqlx::query("DELETE FROM policies WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(PolicyError::NotFound("Policy not found".to_string()));
        }
        Ok(())
    }

    // ========================================================================
    // POLICY EVALUATION
    // ========================================================================

    /// Get all policies that could apply to an entity and permission
    pub async fn get_applicable_policies(
        &self,
        entity_id: Uuid,
        permission: &str,
        entity_class_id: Option<Uuid>,
    ) -> Result<Vec<Policy>, PolicyError> {
        let now = Utc::now();

        // Get policies that:
        // 1. Are active
        // 2. Match the permission (or have empty permissions = all)
        // 3. Match the class (or have NULL = all classes)
        // 4. Are within temporal validity
        // 5. Are scoped globally or to an ancestor entity
        let policies = sqlx::query_as::<_, Policy>(
            r#"
            SELECT p.* FROM policies p
            WHERE p.is_active = TRUE
              AND (p.valid_from IS NULL OR p.valid_from <= $1)
              AND (p.valid_until IS NULL OR p.valid_until > $1)
              AND (p.target_permissions = '{}' OR $2 = ANY(p.target_permissions))
              AND (p.target_class_id IS NULL OR p.target_class_id = $3)
              AND (
                  p.scope_entity_id IS NULL 
                  OR p.scope_entity_id = $4
                  OR p.scope_entity_id IN (SELECT ancestor_id FROM get_entity_ancestors($4))
              )
            ORDER BY p.priority DESC, 
                     CASE WHEN p.effect = 'DENY' THEN 0 ELSE 1 END
            "#,
        )
        .bind(now)
        .bind(permission)
        .bind(entity_class_id)
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(policies)
    }

    /// Evaluate policies against a context
    pub fn evaluate_policies(
        &self,
        policies: &[Policy],
        context: &EvaluationContext,
    ) -> PolicyResult {
        for policy in policies {
            // Check if conditions match
            if evaluate_policy_conditions(&policy.conditions, context) {
                return match policy.effect.as_str() {
                    "DENY" => PolicyResult::Denied {
                        policy_name: policy.name.clone(),
                    },
                    "ALLOW" => PolicyResult::Allowed {
                        policy_name: policy.name.clone(),
                    },
                    _ => continue,
                };
            }
        }
        PolicyResult::NoMatch
    }

    /// Test a policy against a context without persisting
    pub fn test_policy(&self, input: &TestPolicyRequest) -> TestPolicyResponse {
        let would_match = evaluate_policy_conditions(&input.policy.conditions, &input.context);
        let condition_results = test_policy_conditions(&input.policy.conditions, &input.context);

        TestPolicyResponse {
            would_match,
            effect: input.policy.effect.clone(),
            condition_results,
        }
    }

    // ========================================================================
    // LOGGING
    // ========================================================================

    #[allow(clippy::too_many_arguments)]
    pub async fn log_evaluation(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        permission: &str,
        rebac_result: bool,
        policy_result: &PolicyResult,
        final_result: bool,
        context: &EvaluationContext,
    ) -> Result<(), PolicyError> {
        let (policy_result_str, policy_id, policy_name): (&str, Option<Uuid>, Option<String>) =
            match policy_result {
                PolicyResult::Allowed { policy_name } => {
                    ("ALLOWED", None, Some(policy_name.clone()))
                }
                PolicyResult::Denied { policy_name } => ("DENIED", None, Some(policy_name.clone())),
                PolicyResult::NoMatch => ("NO_MATCH", None, None),
            };

        sqlx::query(
            r#"
            INSERT INTO policy_evaluation_log 
                (user_id, entity_id, permission, rebac_result, policy_result, 
                 final_result, decisive_policy_id, decisive_policy_name, context_snapshot)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(user_id)
        .bind(entity_id)
        .bind(permission)
        .bind(rebac_result)
        .bind(policy_result_str)
        .bind(final_result)
        .bind(policy_id)
        .bind(policy_name)
        .bind(serde_json::to_value(context).unwrap_or(JsonValue::Null))
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
