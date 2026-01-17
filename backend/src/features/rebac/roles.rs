use super::service::{RebacError, RebacService};
use uuid::Uuid;

impl RebacService {
    // ========================================================================
    // ROLE HIERARCHY
    // ========================================================================

    pub async fn list_roles(
        &self,
        tenant_id: Option<Uuid>,
    ) -> Result<Vec<crate::features::abac::models::Role>, RebacError> {
        let class = self
            .ontology_service
            .get_system_class("Role")
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let entities = self
            .ontology_service
            .list_entities(Some(class.id), tenant_id, None)
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let roles = entities
            .into_iter()
            .map(|e| crate::features::abac::models::Role {
                id: e.id,
                name: e.display_name,
                description: e
                    .attributes
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                level: e
                    .attributes
                    .get("level")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32,
                tenant_id: e.tenant_id,
                created_at: e.created_at,
            })
            .collect();

        Ok(roles)
    }

    pub async fn update_role_level(&self, role_id: Uuid, level: i32) -> Result<(), RebacError> {
        let mut attributes = serde_json::Map::new();
        attributes.insert("level".to_string(), serde_json::json!(level));

        let entity_input = crate::features::ontology::models::UpdateEntityInput {
            display_name: None,
            parent_entity_id: None,
            attributes: Some(serde_json::Value::Object(attributes)),
        };

        self.ontology_service
            .update_entity(role_id, entity_input, None)
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;
        Ok(())
    }
}
