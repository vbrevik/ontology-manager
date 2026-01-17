use super::service::{RebacError, RebacService};
use uuid::Uuid;

impl RebacService {
    // ========================================================================
    // DELEGATION RULES
    // ========================================================================

    pub async fn list_delegation_rules(
        &self,
        tenant_id: Option<Uuid>,
    ) -> Result<Vec<crate::features::abac::models::RoleDelegationRule>, RebacError> {
        let rel_type = sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
            "SELECT * FROM relationship_types WHERE name = 'can_delegate'",
        )
        .fetch_one(&self.pool)
        .await?;

        let rels = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            "SELECT * FROM relationships WHERE relationship_type_id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)"
        )
        .bind(rel_type.id)
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;

        let rules = rels
            .into_iter()
            .map(|rel| {
                let metadata = rel.metadata.unwrap_or_default();
                crate::features::abac::models::RoleDelegationRule {
                    id: rel.id,
                    granter_role_id: rel.source_entity_id,
                    grantee_role_id: rel.target_entity_id,
                    can_grant: metadata
                        .get("can_grant")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    can_modify: metadata
                        .get("can_modify")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    can_revoke: metadata
                        .get("can_revoke")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    tenant_id: rel.tenant_id,
                    created_at: rel.created_at,
                }
            })
            .collect();

        Ok(rules)
    }

    pub async fn add_delegation_rule(
        &self,
        granter_role_id: Uuid,
        grantee_role_id: Uuid,
        can_grant: bool,
        can_modify: bool,
        can_revoke: bool,
        tenant_id: Option<Uuid>,
    ) -> Result<crate::features::abac::models::RoleDelegationRule, RebacError> {
        let rel_type = sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
            "SELECT * FROM relationship_types WHERE name = 'can_delegate'",
        )
        .fetch_one(&self.pool)
        .await?;

        let metadata = serde_json::json!({
            "can_grant": can_grant,
            "can_modify": can_modify,
            "can_revoke": can_revoke
        });

        let rel = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            r#"
            INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata, tenant_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) 
            DO UPDATE SET 
                metadata = EXCLUDED.metadata,
                tenant_id = EXCLUDED.tenant_id
            RETURNING *
            "#
        )
        .bind(granter_role_id)
        .bind(grantee_role_id)
        .bind(rel_type.id)
        .bind(metadata)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await?;

        let metadata = rel.metadata.unwrap_or_default();
        Ok(crate::features::abac::models::RoleDelegationRule {
            id: rel.id,
            granter_role_id: rel.source_entity_id,
            grantee_role_id: rel.target_entity_id,
            can_grant: metadata
                .get("can_grant")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            can_modify: metadata
                .get("can_modify")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            can_revoke: metadata
                .get("can_revoke")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            tenant_id: rel.tenant_id,
            created_at: rel.created_at,
        })
    }

    pub async fn remove_delegation_rule(&self, rule_id: Uuid) -> Result<(), RebacError> {
        sqlx::query("DELETE FROM relationships WHERE id = $1")
            .bind(rule_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
