use super::models::*;
use super::service::{RebacError, RebacService};
use uuid::Uuid;

impl RebacService {
    // ========================================================================
    // RELATIONSHIP TYPES
    // ========================================================================

    pub async fn list_relationship_types(&self) -> Result<Vec<RelationshipType>, RebacError> {
        let types =
            sqlx::query_as::<_, RelationshipType>("SELECT * FROM relationship_types ORDER BY name")
                .fetch_all(&self.pool)
                .await?;
        Ok(types)
    }

    pub async fn create_relationship_type(
        &self,
        input: CreateRelationshipTypeInput,
    ) -> Result<RelationshipType, RebacError> {
        let rt = sqlx::query_as::<_, RelationshipType>(
            "INSERT INTO relationship_types (name, description, grants_permission_inheritance) VALUES ($1, $2, $3) RETURNING *"
        )
        .bind(input.name)
        .bind(input.description)
        .bind(input.grants_permission_inheritance)
        .fetch_one(&self.pool)
        .await?;
        Ok(rt)
    }

    pub async fn update_relationship_type(
        &self,
        id: Uuid,
        input: UpdateRelationshipTypeInput,
    ) -> Result<RelationshipType, RebacError> {
        let rt = sqlx::query_as::<_, RelationshipType>(
            r#"
            UPDATE relationship_types 
            SET description = COALESCE($2, description),
                grants_permission_inheritance = COALESCE($3, grants_permission_inheritance)
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(input.description)
        .bind(input.grants_permission_inheritance)
        .fetch_one(&self.pool)
        .await?;
        Ok(rt)
    }

    pub async fn delete_relationship_type(&self, id: Uuid) -> Result<(), RebacError> {
        sqlx::query("DELETE FROM relationship_types WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ========================================================================
    // ROLE PERMISSIONS (via Relationships)
    // ========================================================================

    pub async fn get_role_permissions(&self, role_id: Uuid) -> Result<Vec<crate::features::abac::models::Permission>, RebacError> {
        let rel_types = self.list_relationship_types().await?;
        let rel_type = rel_types
            .into_iter()
            .find(|t| t.name == "grants_permission")
            .ok_or_else(|| {
                RebacError::DatabaseError(
                    "Relationship type 'grants_permission' not found".to_string(),
                )
            })?;

        let perms = sqlx::query_as::<_, crate::features::abac::models::Permission>(
            r#"
            SELECT r.id, r.source_entity_id as role_id, e.display_name as action, r.created_at
            FROM relationships r
            JOIN entities e ON r.target_entity_id = e.id
            WHERE r.source_entity_id = $1 AND r.relationship_type_id = $2
            "#,
        )
        .bind(role_id)
        .bind(rel_type.id)
        .fetch_all(&self.pool)
        .await?;
        Ok(perms)
    }

    pub async fn get_role_permission_mappings(
        &self,
        role_id: Uuid,
    ) -> Result<Vec<RolePermissionType>, RebacError> {
        let rel_types = self.list_relationship_types().await?;
        let rel_type = rel_types
            .into_iter()
            .find(|t| t.name == "grants_permission")
            .ok_or_else(|| {
                RebacError::DatabaseError(
                    "Relationship type 'grants_permission' not found".to_string(),
                )
            })?;

        let rels = sqlx::query_as::<_, crate::features::ontology::models::Relationship>(
            "SELECT * FROM relationships WHERE source_entity_id = $1 AND relationship_type_id = $2",
        )
        .bind(role_id)
        .bind(rel_type.id)
        .fetch_all(&self.pool)
        .await?;

        let mappings = rels
            .into_iter()
            .map(|rel| {
                let metadata = rel.metadata.unwrap_or_default();
                RolePermissionType {
                    id: rel.id,
                    role_id: rel.source_entity_id,
                    permission_type_id: rel.target_entity_id,
                    field_name: metadata
                        .get("field_name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    effect: metadata
                        .get("effect")
                        .and_then(|v| v.as_str())
                        .unwrap_or("ALLOW")
                        .to_string(),
                    created_at: rel.created_at,
                }
            })
            .collect();

        Ok(mappings)
    }

    pub async fn add_permission_to_role(
        &self,
        role_id: Uuid,
        permission_name: &str,
        _field_name: Option<String>,
    ) -> Result<(), RebacError> {
        let perm_class = self
            .ontology_service
            .get_system_class("Permission")
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let perm_entity = sqlx::query_as::<_, crate::features::ontology::models::Entity>(
            "SELECT * FROM entities WHERE display_name = $1 AND class_id = $2",
        )
        .bind(permission_name)
        .bind(perm_class.id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| {
            RebacError::NotFound(format!("Permission '{}' not found", permission_name))
        })?;

        let rel_type = sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
            "SELECT * FROM relationship_types WHERE name = 'grants_permission'",
        )
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (source_entity_id, target_entity_id, relationship_type_id) 
            DO UPDATE SET metadata = EXCLUDED.metadata
            "#
        )
        .bind(role_id)
        .bind(perm_entity.id)
        .bind(rel_type.id)
        .bind(serde_json::json!({"effect": "ALLOW"}))
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn remove_permission_from_role(
        &self,
        role_id: Uuid,
        permission_name: &str,
    ) -> Result<(), RebacError> {
        let perm_class = self
            .ontology_service
            .get_system_class("Permission")
            .await
            .map_err(|e| RebacError::DatabaseError(e.to_string()))?;

        let perm_entity = sqlx::query_as::<_, crate::features::ontology::models::Entity>(
            "SELECT * FROM entities WHERE display_name = $1 AND class_id = $2",
        )
        .bind(permission_name)
        .bind(perm_class.id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| {
            RebacError::NotFound(format!("Permission '{}' not found", permission_name))
        })?;

        let rel_type = sqlx::query_as::<_, crate::features::ontology::models::RelationshipType>(
            "SELECT * FROM relationship_types WHERE name = 'grants_permission'",
        )
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            "DELETE FROM relationships WHERE source_entity_id = $1 AND target_entity_id = $2 AND relationship_type_id = $3"
        )
        .bind(role_id)
        .bind(perm_entity.id)
        .bind(rel_type.id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
