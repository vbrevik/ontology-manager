use super::policy_models::EvaluationContext;
use super::service::{RebacError, RebacService};
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;

impl RebacService {
    // ========================================================================
    // POLICY ENGINE BRIDGE
    // ========================================================================

    /// Helper to build EvaluationContext with entity/user attributes
    pub async fn build_evaluation_context(
        &self,
        user_id: Uuid,
        entity_id: Uuid,
        permission: &str,
        custom_request_context: Option<serde_json::Map<String, serde_json::Value>>,
    ) -> Result<EvaluationContext, RebacError> {
        // Fetch entity attributes
        let entity_row = sqlx::query("SELECT display_name, attributes FROM entities WHERE id = $1")
            .bind(entity_id)
            .fetch_one(&self.pool)
            .await?;

        let display_name: String = entity_row.get(0);
        let attributes: serde_json::Value = entity_row.get(1);

        // Fetch user data
        let email: Option<String> = sqlx::query_scalar("SELECT email FROM unified_users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;

        let mut context = EvaluationContext::new();

        // 1. Entity attributes
        if let Some(obj) = attributes.as_object() {
            for (k, v) in obj {
                context.entity.insert(k.clone(), v.clone());
            }
        }
        context.entity.insert(
            "id".to_string(),
            serde_json::Value::String(entity_id.to_string()),
        );
        context.entity.insert(
            "display_name".to_string(),
            serde_json::Value::String(display_name),
        );

        // 2. User attributes
        context.user.insert(
            "id".to_string(),
            serde_json::Value::String(user_id.to_string()),
        );
        context.user.insert(
            "email".to_string(), 
            serde_json::Value::String(email.unwrap_or_default())
        );

        // 3. Environment attributes
        context.env.insert(
            "now".to_string(),
            serde_json::Value::String(Utc::now().to_rfc3339()),
        );

        // 4. Request attributes
        context.request.insert(
            "permission".to_string(),
            serde_json::Value::String(permission.to_string()),
        );
        if let Some(custom) = custom_request_context {
            for (k, v) in custom {
                context.request.insert(k, v);
            }
        }

        Ok(context)
    }
}
