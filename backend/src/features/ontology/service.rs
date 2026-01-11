use sqlx::{Pool, Postgres, FromRow};
use axum::http::StatusCode;
use uuid::Uuid;
use super::models::*;

#[derive(Debug)]
pub enum OntologyError {
    DatabaseError(String),
    NotFound(String),
    InvalidInput(String),
    VersionConflict(String),
}

impl std::fmt::Display for OntologyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            Self::NotFound(msg) => write!(f, "Not found: {}", msg),
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            Self::VersionConflict(msg) => write!(f, "Version conflict: {}", msg),
        }
    }
}

impl From<sqlx::Error> for OntologyError {
    fn from(err: sqlx::Error) -> Self {
        OntologyError::DatabaseError(err.to_string())
    }
}

impl OntologyError {
    pub fn to_status_code(&self) -> StatusCode {
        match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::InvalidInput(_) => StatusCode::BAD_REQUEST,
            Self::VersionConflict(_) => StatusCode::CONFLICT,
            Self::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Clone)]
pub struct OntologyService {
    pool: Pool<Postgres>,
    audit_service: crate::features::system::AuditService,
}

impl OntologyService {
    pub fn new(pool: Pool<Postgres>, audit_service: crate::features::system::AuditService) -> Self {
        Self { pool, audit_service }
    }

    // ========================================================================
    // SCHEMA VERSIONS
    // ========================================================================

    pub async fn list_versions(&self) -> Result<Vec<OntologyVersion>, OntologyError> {
        let versions = sqlx::query_as::<_, OntologyVersion>(
            "SELECT * FROM ontology_versions ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(versions)
    }

    pub async fn get_current_version(&self) -> Result<OntologyVersion, OntologyError> {
        sqlx::query_as::<_, OntologyVersion>(
            "SELECT * FROM ontology_versions WHERE is_current = TRUE"
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| OntologyError::NotFound("No current version found".to_string()))
    }

    /// Get the system ontology version
    pub async fn get_system_version(&self) -> Result<OntologyVersion, OntologyError> {
        sqlx::query_as::<_, OntologyVersion>(
            "SELECT * FROM ontology_versions WHERE is_system = TRUE"
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| OntologyError::NotFound("System ontology version not found".to_string()))
    }

    /// Get a system class by name
    pub async fn get_system_class(&self, class_name: &str) -> Result<Class, OntologyError> {
        let system_version = self.get_system_version().await?;
        sqlx::query_as::<_, Class>(
            "SELECT * FROM classes WHERE name = $1 AND version_id = $2"
        )
        .bind(class_name)
        .bind(system_version.id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| OntologyError::NotFound(format!("System class '{}' not found", class_name)))
    }
    pub async fn create_version(&self, input: CreateVersionInput, user_id: Option<Uuid>) -> Result<OntologyVersion, OntologyError> {
        let version = sqlx::query_as::<_, OntologyVersion>(
            r#"
            INSERT INTO ontology_versions (version, description, status, is_current, created_by)
            VALUES ($1, $2, 'DRAFT', FALSE, $3)
            RETURNING *
            "#
        )
        .bind(&input.version)
        .bind(&input.description)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(version)
    }


    pub async fn get_version(&self, id: Uuid) -> Result<OntologyVersion, OntologyError> {
        sqlx::query_as::<_, OntologyVersion>("SELECT * FROM ontology_versions WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| OntologyError::NotFound(format!("Version {} not found", id)))
    }

    pub async fn ensure_version_mutable(&self, version_id: Uuid) -> Result<(), OntologyError> {
        let version = self.get_version(version_id).await?;
        if version.status != OntologyVersionStatus::DRAFT {
            return Err(OntologyError::VersionConflict(format!(
                "Version {} is {:?} and cannot be modified",
                version.version, version.status
            )));
        }
        Ok(())
    }

    pub async fn clone_version(&self, source_id: Uuid, new_version_name: String, user_id: Option<Uuid>) -> Result<OntologyVersion, OntologyError> {
        let mut tx = self.pool.begin().await?;

        // 1. Create a new DRAFT version
        let new_version = sqlx::query_as::<_, OntologyVersion>(
            r#"
            INSERT INTO ontology_versions (version, description, status, is_current, cloned_from_id, created_by)
            SELECT $2, 'Cloned from ' || version, 'DRAFT', FALSE, id, $3
            FROM ontology_versions WHERE id = $1
            RETURNING *
            "#
        )
        .bind(source_id)
        .bind(new_version_name)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        // 2. Clone Classes (maintaining hierarchy)
        // We need a mapping from old_id to new_id to fix parent_class_id
        #[derive(FromRow)]
        struct IdMap { old_id: Uuid, new_id: Uuid }

        let classes = sqlx::query_as::<_, Class>(
            "SELECT * FROM classes WHERE version_id = $1"
        )
        .bind(source_id)
        .fetch_all(&self.pool).await?; // Fetching outside tx to avoid lock issues if any, but since it's read it's fine

        let mut class_id_map = std::collections::HashMap::new();

        // Pass 1: Simple insert without parent link (to get IDs)
        for class in &classes {
            let new_class_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO classes (id, name, description, version_id, tenant_id, is_abstract)
                VALUES ($1, $2, $3, $4, $5, $6)
                "#
            )
            .bind(new_class_id)
            .bind(&class.name)
            .bind(&class.description)
            .bind(new_version.id)
            .bind(class.tenant_id)
            .bind(class.is_abstract)
            .execute(&mut *tx)
            .await?;
            
            class_id_map.insert(class.id, new_class_id);
        }

        // Pass 2: Update parent_class_id based on mapping
        for class in &classes {
            if let Some(old_parent_id) = class.parent_class_id {
                if let Some(new_parent_id) = class_id_map.get(&old_parent_id) {
                    sqlx::query("UPDATE classes SET parent_class_id = $1 WHERE id = $2")
                        .bind(new_parent_id)
                        .bind(class_id_map.get(&class.id))
                        .execute(&mut *tx)
                        .await?;
                }
            }
        }

        // 3. Clone Properties
        for class in &classes {
            let new_class_id = class_id_map.get(&class.id).unwrap();
            sqlx::query(
                r#"
                INSERT INTO properties (
                    name, description, class_id, data_type, reference_class_id, 
                    is_required, is_unique, is_indexed, is_sensitive, 
                    default_value, validation_rules, version_id
                )
                SELECT 
                    name, description, $2, data_type, 
                    CASE WHEN reference_class_id IS NOT NULL THEN $3 ELSE NULL END,
                    is_required, is_unique, is_indexed, is_sensitive, 
                    default_value, validation_rules, $4
                FROM properties WHERE class_id = $1
                "#
            )
            .bind(class.id)
            .bind(new_class_id)
            .bind(None::<Uuid>) // Simplified: reference_class_id needs similar mapping if it points within version
            .bind(new_version.id)
            .execute(&mut *tx)
            .await?;
            
            // Note: For reference_class_id, a more complex mapping would be needed if it points to another class in the same version.
            // For now, setting to NULL or keeping as is if external.
        }

        tx.commit().await?;

        // Log clone action
        if let Some(uid) = user_id {
            let _ = self.audit_service.log(
                uid,
                "ontology.version.clone",
                "ontology_version",
                Some(new_version.id),
                Some(serde_json::json!({ "source_id": source_id })),
                Some(serde_json::to_value(&new_version).unwrap_or(serde_json::Value::Null)),
                None,
            ).await;
        }

        Ok(new_version)
    }

    pub async fn publish_version(&self, id: Uuid, user_id: Option<Uuid>) -> Result<OntologyVersion, OntologyError> {
        let mut tx = self.pool.begin().await?;

        // 1. Mark existing current as ARCHIVED
        sqlx::query("UPDATE ontology_versions SET status = 'ARCHIVED', is_current = FALSE WHERE is_current = TRUE")
            .execute(&mut *tx)
            .await?;

        // 2. Mark new as PUBLISHED and current
        let version = sqlx::query_as::<_, OntologyVersion>(
            r#"
            UPDATE ontology_versions 
            SET status = 'PUBLISHED', is_current = TRUE 
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;

        // Log publish action
        if let Some(uid) = user_id {
            let _ = self.audit_service.log(
                uid,
                "ontology.version.publish",
                "ontology_version",
                Some(version.id),
                None,
                Some(serde_json::to_value(&version).unwrap_or(serde_json::Value::Null)),
                None,
            ).await;
        }

        Ok(version)
    }

    // ========================================================================
    // CLASSES
    // ========================================================================

    pub async fn list_classes(&self, tenant_id: Option<Uuid>) -> Result<Vec<ClassWithParent>, OntologyError> {
        let classes = sqlx::query_as::<_, ClassWithParent>(
            r#"
            SELECT c.id, c.name, c.description, c.parent_class_id, 
                   p.name as parent_class_name, c.version_id,
                   c.is_abstract, c.is_deprecated, c.created_at
            FROM classes c
            LEFT JOIN classes p ON c.parent_class_id = p.id
            WHERE (c.tenant_id IS NULL OR c.tenant_id = $1)
            ORDER BY c.name
            "#
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(classes)
    }

    pub async fn get_class(&self, id: Uuid) -> Result<Class, OntologyError> {
        sqlx::query_as::<_, Class>("SELECT * FROM classes WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| OntologyError::NotFound(format!("Class {} not found", id)))
    }

    pub async fn create_class(&self, input: CreateClassInput, tenant_id: Option<Uuid>) -> Result<Class, OntologyError> {
        let current_version = self.get_current_version().await?;

        let class = sqlx::query_as::<_, Class>(
            r#"
            INSERT INTO classes (name, description, parent_class_id, version_id, tenant_id, is_abstract)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#
        )
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.parent_class_id)
        .bind(current_version.id)
        .bind(tenant_id)
        .bind(input.is_abstract.unwrap_or(false))
        .fetch_one(&self.pool)
        .await?;

        Ok(class)
    }

    pub async fn update_class(&self, id: Uuid, input: UpdateClassInput) -> Result<Class, OntologyError> {
        let existing = self.get_class(id).await?;
        self.ensure_version_mutable(existing.version_id).await?;

        let class = sqlx::query_as::<_, Class>(
            r#"
            UPDATE classes SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                parent_class_id = COALESCE($4, parent_class_id),
                is_abstract = COALESCE($5, is_abstract),
                is_deprecated = COALESCE($6, is_deprecated),
                deprecated_at = CASE WHEN $6 = TRUE AND is_deprecated = FALSE THEN NOW() ELSE deprecated_at END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.parent_class_id.or(existing.parent_class_id))
        .bind(input.is_abstract)
        .bind(input.is_deprecated)
        .fetch_one(&self.pool)
        .await?;

        Ok(class)
    }

    pub async fn delete_class(&self, id: Uuid) -> Result<(), OntologyError> {
        let existing = self.get_class(id).await?;
        self.ensure_version_mutable(existing.version_id).await?;

        let result = sqlx::query("DELETE FROM classes WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(OntologyError::NotFound(format!("Class {} not found", id)));
        }
        Ok(())
    }

    // ========================================================================
    // PROPERTIES
    // ========================================================================

    pub async fn list_properties(&self, class_id: Uuid) -> Result<Vec<Property>, OntologyError> {
        let properties = sqlx::query_as::<_, Property>(
            "SELECT * FROM properties WHERE class_id = $1 ORDER BY name"
        )
        .bind(class_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(properties)
    }

    pub async fn get_property(&self, id: Uuid) -> Result<Property, OntologyError> {
        sqlx::query_as::<_, Property>("SELECT * FROM properties WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| OntologyError::NotFound(format!("Property {} not found", id)))
    }

    pub async fn create_property(&self, input: CreatePropertyInput) -> Result<Property, OntologyError> {
        let class = self.get_class(input.class_id).await?;
        self.ensure_version_mutable(class.version_id).await?;

        let property = sqlx::query_as::<_, Property>(
            r#"
            INSERT INTO properties (name, description, class_id, data_type, reference_class_id,
                                    is_required, is_unique, is_indexed, is_sensitive,
                                    default_value, validation_rules, version_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
            "#
        )
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.class_id)
        .bind(&input.data_type)
        .bind(input.reference_class_id)
        .bind(input.is_required.unwrap_or(false))
        .bind(input.is_unique.unwrap_or(false))
        .bind(input.is_indexed.unwrap_or(false))
        .bind(input.is_sensitive.unwrap_or(false))
        .bind(&input.default_value)
        .bind(&input.validation_rules)
        .bind(class.version_id) // Use the version_id of the class it belongs to
        .fetch_one(&self.pool)
        .await?;

        Ok(property)
    }
    pub async fn update_property(&self, id: Uuid, input: UpdatePropertyInput) -> Result<Property, OntologyError> {
        let existing = self.get_property(id).await?;
        self.ensure_version_mutable(existing.version_id).await?;

        // Handle specific case for validation_rules where we might want to clear it (set to NULL)
        // input.validation_rules is Option<serde_json::Value>
        // If it's None, it means "don't change". 
        // If it's Some(Value::Null), it means "set to NULL".
        
        let property = sqlx::query_as::<_, Property>(
            r#"
            UPDATE properties SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                data_type = COALESCE($4, data_type),
                reference_class_id = COALESCE($5, reference_class_id),
                is_required = COALESCE($6, is_required),
                is_unique = COALESCE($7, is_unique),
                is_indexed = COALESCE($8, is_indexed),
                is_sensitive = COALESCE($9, is_sensitive),
                default_value = COALESCE($10, default_value),
                validation_rules = $11,
                is_deprecated = COALESCE($12, is_deprecated),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.data_type)
        .bind(input.reference_class_id)
        .bind(input.is_required)
        .bind(input.is_unique)
        .bind(input.is_indexed)
        .bind(input.is_sensitive)
        .bind(&input.default_value)
        .bind(input.validation_rules.as_ref().or(existing.validation_rules.as_ref()))
        .bind(input.is_deprecated)
        .fetch_one(&self.pool)
        .await?;

        Ok(property)
    }

    pub async fn delete_property(&self, id: Uuid) -> Result<(), OntologyError> {
        let existing = self.get_property(id).await?;
        self.ensure_version_mutable(existing.version_id).await?;

        let result = sqlx::query("DELETE FROM properties WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(OntologyError::NotFound(format!("Property {} not found", id)));
        }
        Ok(())
    }

    // ========================================================================
    // ENTITIES
    // ========================================================================

    pub async fn list_entities(&self, class_id: Option<Uuid>, tenant_id: Option<Uuid>, is_root: Option<bool>) -> Result<Vec<EntityWithDetails>, OntologyError> {
        let entities = sqlx::query_as::<_, EntityWithDetails>(
            r#"
            SELECT e.id, e.class_id, c.name as class_name, e.display_name,
                   e.parent_entity_id, p.display_name as parent_entity_name,
                   e.attributes, e.approval_status, e.created_at, e.updated_at
            FROM entities e
            JOIN classes c ON e.class_id = c.id
            LEFT JOIN entities p ON e.parent_entity_id = p.id
            WHERE e.deleted_at IS NULL
              AND ($1::uuid IS NULL OR e.class_id = $1)
              AND ($2::uuid IS NULL OR e.tenant_id = $2)
              AND ($3::boolean IS NULL 
                   OR ($3 = TRUE AND e.parent_entity_id IS NULL)
                   OR ($3 = FALSE AND e.parent_entity_id IS NOT NULL))
            ORDER BY e.display_name
            "#
        )
        .bind(class_id)
        .bind(tenant_id)
        .bind(is_root)
        .fetch_all(&self.pool)
        .await?;
        Ok(entities)
    }

    pub async fn get_entity(&self, id: Uuid) -> Result<Entity, OntologyError> {
        sqlx::query_as::<_, Entity>(
            "SELECT * FROM entities WHERE id = $1 AND deleted_at IS NULL"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| OntologyError::NotFound(format!("Entity {} not found", id)))
    }

    pub async fn create_entity(&self, input: CreateEntityInput, user_id: Option<Uuid>, tenant_id: Option<Uuid>) -> Result<Entity, OntologyError> {
        let attributes = input.attributes.unwrap_or(serde_json::json!({}));
        
        // Validate attributes against class properties
        self.validate_entity_attributes(input.class_id, &attributes, false).await?;

        // Root entities (contexts) default to PENDING approval
        // Child entities are automatically APPROVED as they are usually part of an already approved context
        let approval_status = if input.parent_entity_id.is_none() {
            ApprovalStatus::PENDING
        } else {
            ApprovalStatus::APPROVED
        };

        let entity = sqlx::query_as::<_, Entity>(
            r#"
            INSERT INTO entities (class_id, display_name, parent_entity_id, tenant_id, attributes, approval_status, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
            RETURNING *
            "#
        )
        .bind(input.class_id)
        .bind(&input.display_name)
        .bind(input.parent_entity_id)
        .bind(tenant_id)
        .bind(attributes)
        .bind(approval_status)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(entity)
    }

    pub async fn update_entity(&self, id: Uuid, input: UpdateEntityInput, user_id: Option<Uuid>) -> Result<Entity, OntologyError> {
        let existing = self.get_entity(id).await?;

        // If attributes are being updated, validate them
        if let Some(ref attributes) = input.attributes {
            self.validate_entity_attributes(existing.class_id, attributes, true).await?;
        }

        let entity = sqlx::query_as::<_, Entity>(
            r#"
            UPDATE entities SET
                display_name = COALESCE($2, display_name),
                parent_entity_id = COALESCE($3, parent_entity_id),
                attributes = COALESCE($4, attributes),
                updated_by = $5,
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#
        )
        .bind(id)
        .bind(&input.display_name)
        .bind(input.parent_entity_id.or(existing.parent_entity_id))
        .bind(&input.attributes)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(entity)
    }

    pub async fn delete_entity(&self, id: Uuid, user_id: Option<Uuid>) -> Result<(), OntologyError> {
        // Soft delete
        let result = sqlx::query(
            "UPDATE entities SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL"
        )
        .bind(id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(OntologyError::NotFound(format!("Entity {} not found", id)));
        }
        Ok(())
    }

    pub async fn approve_entity(&self, id: Uuid, user_id: Option<Uuid>) -> Result<Entity, OntologyError> {
        let entity = sqlx::query_as::<_, Entity>(
            r#"
            UPDATE entities 
            SET approval_status = 'APPROVED', 
                approved_by = $2, 
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#
        )
        .bind(id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(entity)
    }

    pub async fn reject_entity(&self, id: Uuid, user_id: Option<Uuid>) -> Result<Entity, OntologyError> {
        let entity = sqlx::query_as::<_, Entity>(
            r#"
            UPDATE entities 
            SET approval_status = 'REJECTED', 
                updated_by = $2,
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#
        )
        .bind(id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(entity)
    }

    // ========================================================================
    // GRAPH TRAVERSAL
    // ========================================================================

    pub async fn get_entity_ancestors(&self, entity_id: Uuid) -> Result<Vec<EntityPathNode>, OntologyError> {
        let ancestors = sqlx::query_as::<_, EntityPathNode>(
            "SELECT * FROM get_entity_ancestors($1)"
        )
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(ancestors)
    }

    pub async fn get_entity_descendants(&self, entity_id: Uuid) -> Result<Vec<EntityDescendantNode>, OntologyError> {
        let descendants = sqlx::query_as::<_, EntityDescendantNode>(
            "SELECT * FROM get_entity_descendants($1)"
        )
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(descendants)
    }

    // ========================================================================
    // RELATIONSHIPS
    // ========================================================================

    /// Validates entity attributes against class property definitions and rules
    async fn validate_entity_attributes(
        &self,
        class_id: Uuid,
        attributes: &serde_json::Value,
        is_update: bool,
    ) -> Result<(), OntologyError> {
        let attr_obj = attributes.as_object().ok_or_else(|| {
            OntologyError::InvalidInput("Attributes must be a JSON object".to_string())
        })?;

        // 1. Fetch all properties for this class and its ancestors
        // Using a recursive CTE to get all relevant properties
        let properties = sqlx::query_as::<_, Property>(
            r#"
            WITH RECURSIVE class_hierarchy AS (
                SELECT id, parent_class_id FROM classes WHERE id = $1
                UNION ALL
                SELECT c.id, c.parent_class_id FROM classes c
                JOIN class_hierarchy ch ON c.id = ch.parent_class_id
            )
            SELECT p.* FROM properties p
            JOIN class_hierarchy ch ON p.class_id = ch.id
            WHERE p.is_deprecated = FALSE
            "#
        )
        .bind(class_id)
        .fetch_all(&self.pool)
        .await?;

        // 2. Validate each property
        for prop in properties {
            let val = attr_obj.get(&prop.name);

            // Check if required
            if prop.is_required && (val.is_none() || val.unwrap().is_null()) {
                if !is_update || attr_obj.contains_key(&prop.name) {
                    return Err(OntologyError::InvalidInput(format!(
                        "Property '{}' is required",
                        prop.name
                    )));
                }
            }

            if let Some(v) = val {
                if v.is_null() {
                    continue;
                }

                // Check Data Type
                match prop.data_type.to_lowercase().as_str() {
                    "string" if !v.is_string() => {
                        return Err(OntologyError::InvalidInput(format!(
                            "Property '{}' must be a string",
                            prop.name
                        )));
                    }
                    "number" | "integer" | "float" if !v.is_number() => {
                        return Err(OntologyError::InvalidInput(format!(
                            "Property '{}' must be a number",
                            prop.name
                        )));
                    }
                    "boolean" if !v.is_boolean() => {
                        return Err(OntologyError::InvalidInput(format!(
                            "Property '{}' must be a boolean",
                            prop.name
                        )));
                    }
                    _ => {} // Other types like 'json' or 'date' can be added later
                }

                // Check Validation Rules
                if let Some(rules) = prop.validation_rules.as_ref() {
                    if let Some(rules_obj) = rules.as_object() {
                        // Regex validation
                        if let Some(serde_json::Value::String(pattern)) = rules_obj.get("regex") {
                            if let Some(s) = v.as_str() {
                                let re = regex::Regex::new(pattern).map_err(|e| {
                                    OntologyError::DatabaseError(format!("Invalid regex rule: {}", e))
                                })?;
                                if !re.is_match(s) {
                                    return Err(OntologyError::InvalidInput(format!(
                                        "Property '{}' does not match pattern",
                                        prop.name
                                    )));
                                }
                            }
                        }

                        // Numeric range
                        if v.is_number() {
                            let n = v.as_f64().unwrap();
                            if let Some(min) = rules_obj.get("min").and_then(|m| m.as_f64()) {
                                if n < min {
                                    return Err(OntologyError::InvalidInput(format!(
                                        "Property '{}' must be at least {}",
                                        prop.name, min
                                    )));
                                }
                            }
                            if let Some(max) = rules_obj.get("max").and_then(|m| m.as_f64()) {
                                if n > max {
                                    return Err(OntologyError::InvalidInput(format!(
                                        "Property '{}' must be at most {}",
                                        prop.name, max
                                    )));
                                }
                            }
                        }

                        // Enum/Options
                        if let Some(options) = rules_obj.get("options").and_then(|o| o.as_array()) {
                            if !options.contains(v) {
                                return Err(OntologyError::InvalidInput(format!(
                                    "Property '{}' must be one of: {:?}",
                                    prop.name, options
                                )));
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn list_relationship_types(&self) -> Result<Vec<RelationshipType>, OntologyError> {
        let types = sqlx::query_as::<_, RelationshipType>(
            "SELECT * FROM relationship_types ORDER BY name"
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(types)
    }

    pub async fn create_relationship(&self, input: CreateRelationshipInput, user_id: Option<Uuid>) -> Result<Relationship, OntologyError> {
        // Find relationship type by name
        let rel_type = sqlx::query_as::<_, RelationshipType>(
            "SELECT * FROM relationship_types WHERE name = $1"
        )
        .bind(&input.relationship_type)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| OntologyError::InvalidInput(
            format!("Relationship type '{}' not found", input.relationship_type)
        ))?;

        let relationship = sqlx::query_as::<_, Relationship>(
            r#"
            INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type_id, metadata, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#
        )
        .bind(input.source_entity_id)
        .bind(input.target_entity_id)
        .bind(rel_type.id)
        .bind(&input.metadata)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(relationship)
    }

    pub async fn get_entity_relationships(&self, entity_id: Uuid, direction: Option<&str>) -> Result<Vec<RelationshipWithDetails>, OntologyError> {
        let dir = direction.unwrap_or("both");
        
        let relationships = sqlx::query_as::<_, RelationshipWithDetails>(
            r#"
            SELECT r.id, r.source_entity_id, s.display_name as source_entity_name,
                   r.target_entity_id, t.display_name as target_entity_name,
                   r.relationship_type_id, rt.name as relationship_type_name,
                   r.metadata, r.created_at
            FROM relationships r
            JOIN entities s ON r.source_entity_id = s.id
            JOIN entities t ON r.target_entity_id = t.id
            JOIN relationship_types rt ON r.relationship_type_id = rt.id
            WHERE s.deleted_at IS NULL AND t.deleted_at IS NULL
              AND (
                  ($2 IN ('outgoing', 'both') AND r.source_entity_id = $1)
                  OR ($2 IN ('incoming', 'both') AND r.target_entity_id = $1)
              )
            ORDER BY rt.name, r.created_at
            "#
        )
        .bind(entity_id)
        .bind(dir)
        .fetch_all(&self.pool)
        .await?;

        Ok(relationships)
    }

    pub async fn delete_relationship(&self, id: Uuid) -> Result<(), OntologyError> {
        let result = sqlx::query("DELETE FROM relationships WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(OntologyError::NotFound(format!("Relationship {} not found", id)));
        }
        Ok(())
    }
}
