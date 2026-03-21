diff --git a/backend/Cargo.lock b/backend/Cargo.lock
index 3d34269..41844b6 100644
--- a/backend/Cargo.lock
+++ b/backend/Cargo.lock
@@ -3228,6 +3228,7 @@ dependencies = [
  "rsa",
  "serde",
  "serde_json",
+ "serde_urlencoded",
  "sha2",
  "sqlx",
  "sysinfo",
diff --git a/backend/Cargo.toml b/backend/Cargo.toml
index ab9b8ca..f0826a9 100644
--- a/backend/Cargo.toml
+++ b/backend/Cargo.toml
@@ -44,3 +44,4 @@ totp-rs = { version = "5.6", features = ["gen_secret", "qr"] }
 tokio-test = "0.4"
 tower = { version = "0.5.3", features = ["util"] }
 tempfile = "3"
+serde_urlencoded = "0.7"
diff --git a/backend/src/features/import_engine/mod.rs b/backend/src/features/import_engine/mod.rs
new file mode 100644
index 0000000..7d7ac16
--- /dev/null
+++ b/backend/src/features/import_engine/mod.rs
@@ -0,0 +1,3 @@
+pub mod models;
+
+pub use models::*;
diff --git a/backend/src/features/import_engine/models.rs b/backend/src/features/import_engine/models.rs
new file mode 100644
index 0000000..4ec1803
--- /dev/null
+++ b/backend/src/features/import_engine/models.rs
@@ -0,0 +1,443 @@
+use chrono::{DateTime, Utc};
+use serde::{Deserialize, Serialize};
+use std::collections::HashMap;
+
+use axum::http::StatusCode;
+use axum::response::{IntoResponse, Response};
+use axum::Json;
+
+// ============================================================================
+// INTERMEDIATE REPRESENTATION (output of format adapters)
+// ============================================================================
+
+/// Common intermediate representation produced by all format adapters.
+#[derive(Debug, Clone)]
+pub struct ParsedOntology {
+    pub classes: Vec<ParsedClass>,
+    pub properties: Vec<ParsedProperty>,
+    pub relationship_types: Vec<ParsedRelationshipType>,
+}
+
+#[derive(Debug, Clone)]
+pub struct ParsedClass {
+    pub name: String,
+    pub parent_name: Option<String>,
+    pub description: Option<String>,
+    pub is_abstract: bool,
+    pub is_system: bool,
+}
+
+#[derive(Debug, Clone)]
+pub struct ParsedProperty {
+    pub name: String,
+    pub class_name: String,
+    pub data_type: String,
+    pub is_required: bool,
+    pub is_unique: bool,
+    pub is_sensitive: bool,
+    pub description: Option<String>,
+    pub validation_rules: Option<serde_json::Value>,
+}
+
+#[derive(Debug, Clone)]
+pub struct ParsedRelationshipType {
+    pub name: String,
+    pub description: Option<String>,
+    pub source_class_name: Option<String>,
+    pub target_class_name: Option<String>,
+    pub source_cardinality: String,
+    pub target_cardinality: String,
+    pub grants_permission_inheritance: bool,
+}
+
+// ============================================================================
+// API RESPONSE STRUCTS
+// ============================================================================
+
+/// Result returned from POST /{id}/import
+#[derive(Debug, Clone, Serialize, Deserialize)]
+pub struct ImportResult {
+    pub source_id: String,
+    pub role: String,
+    pub imported: ImportStats,
+    pub conflicts: Vec<ConflictEntry>,
+    pub imported_at: DateTime<Utc>,
+}
+
+#[derive(Debug, Clone, Serialize, Deserialize)]
+pub struct ImportStats {
+    pub classes: usize,
+    pub properties: usize,
+    pub relationship_types: usize,
+}
+
+#[derive(Debug, Clone, Serialize, Deserialize)]
+pub struct ConflictEntry {
+    pub entity_type: String,
+    pub name: String,
+    pub base_source: String,
+    pub extension_source: String,
+}
+
+/// Result returned from DELETE /{id}/import
+#[derive(Debug, Clone, Serialize, Deserialize)]
+pub struct UnloadResult {
+    pub source_id: String,
+    pub removed: ImportStats,
+}
+
+// ============================================================================
+// FILE-FORMAT DESERIALIZATION (JSON / system-ontology)
+// ============================================================================
+
+/// Wrapper for classes.json: {"classes": [...]}
+#[derive(Debug, Deserialize)]
+pub struct JsonClassesFile {
+    pub classes: Vec<JsonClassEntry>,
+}
+
+#[derive(Debug, Deserialize)]
+pub struct JsonClassEntry {
+    pub name: String,
+    pub parent: Option<String>,
+    #[serde(default)]
+    pub is_abstract: bool,
+    #[serde(default)]
+    pub is_system: bool,
+    pub description: Option<String>,
+}
+
+/// Wrapper for properties.json: {"properties": {"ClassName": [...]}}
+#[derive(Debug, Deserialize)]
+pub struct JsonPropertiesFile {
+    pub properties: HashMap<String, Vec<JsonPropertyEntry>>,
+}
+
+#[derive(Debug, Deserialize)]
+pub struct JsonPropertyEntry {
+    pub name: String,
+    #[serde(rename = "type")]
+    pub data_type: String,
+    #[serde(default)]
+    pub required: bool,
+    #[serde(default)]
+    pub unique: bool,
+    #[serde(default)]
+    pub sensitive: bool,
+    pub description: Option<String>,
+    #[serde(rename = "enum")]
+    pub enum_values: Option<Vec<String>>,
+}
+
+/// Wrapper for relationship_types.json: {"relationship_types": [...]}
+#[derive(Debug, Deserialize)]
+pub struct JsonRelationshipTypesFile {
+    pub relationship_types: Vec<JsonRelationshipTypeEntry>,
+}
+
+#[derive(Debug, Deserialize)]
+pub struct JsonRelationshipTypeEntry {
+    pub name: String,
+    pub description: Option<String>,
+    pub source_class: Option<String>,
+    pub target_class: Option<String>,
+    pub cardinality: Option<String>,
+    #[serde(default)]
+    pub grants_permission_inheritance: bool,
+}
+
+// ============================================================================
+// QUERY PARAMS
+// ============================================================================
+
+#[derive(Debug, Deserialize)]
+pub struct ImportParams {
+    pub role: Option<String>,
+}
+
+// ============================================================================
+// ERROR TYPE
+// ============================================================================
+
+#[derive(Debug, thiserror::Error)]
+pub enum ImportError {
+    #[error("IO error: {0}")]
+    IoError(#[from] std::io::Error),
+
+    #[error("Parse error: {0}")]
+    ParseError(String),
+
+    #[error("Database error: {0}")]
+    DatabaseError(#[from] sqlx::Error),
+
+    #[error("Not found: {0}")]
+    NotFound(String),
+
+    #[error("Invalid input: {0}")]
+    InvalidInput(String),
+
+    #[error("Import failed: {0}")]
+    ImportFailed(String),
+}
+
+impl IntoResponse for ImportError {
+    fn into_response(self) -> Response {
+        let status = match &self {
+            Self::IoError(_) => StatusCode::INTERNAL_SERVER_ERROR,
+            Self::ParseError(_) => StatusCode::BAD_REQUEST,
+            Self::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
+            Self::NotFound(_) => StatusCode::NOT_FOUND,
+            Self::InvalidInput(_) => StatusCode::BAD_REQUEST,
+            Self::ImportFailed(_) => StatusCode::INTERNAL_SERVER_ERROR,
+        };
+        let body = serde_json::json!({ "error": self.to_string() });
+        (status, Json(body)).into_response()
+    }
+}
+
+// ============================================================================
+// TESTS
+// ============================================================================
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::features::ontology::models::{Class, Property, RelationshipType};
+    use axum::http::StatusCode;
+    use chrono::Utc;
+    use uuid::Uuid;
+
+    #[test]
+    fn test_existing_class_model_has_source_id() {
+        let now = Utc::now();
+        let class = Class {
+            id: Uuid::new_v4(),
+            name: "TestClass".to_string(),
+            description: None,
+            parent_class_id: None,
+            version_id: Uuid::new_v4(),
+            tenant_id: None,
+            is_abstract: false,
+            is_deprecated: false,
+            deprecated_at: None,
+            created_at: now,
+            updated_at: now,
+            source_id: Some("test-source".to_string()),
+            is_system: true,
+        };
+        assert_eq!(class.source_id, Some("test-source".to_string()));
+        assert!(class.is_system);
+    }
+
+    #[test]
+    fn test_existing_property_has_source_id() {
+        let now = Utc::now();
+        let prop = Property {
+            id: Uuid::new_v4(),
+            name: "test_prop".to_string(),
+            description: None,
+            class_id: Uuid::new_v4(),
+            data_type: "string".to_string(),
+            reference_class_id: None,
+            is_required: false,
+            is_unique: false,
+            is_indexed: false,
+            is_sensitive: false,
+            default_value: None,
+            validation_rules: None,
+            version_id: Uuid::new_v4(),
+            is_deprecated: false,
+            deprecated_at: None,
+            created_at: now,
+            updated_at: now,
+            source_id: Some("src".to_string()),
+        };
+        assert_eq!(prop.source_id, Some("src".to_string()));
+    }
+
+    #[test]
+    fn test_existing_relationship_type_has_source_id() {
+        let rt = RelationshipType {
+            id: Uuid::new_v4(),
+            name: "contains".to_string(),
+            description: None,
+            source_cardinality: Some("many".to_string()),
+            target_cardinality: Some("one".to_string()),
+            allowed_source_class_id: None,
+            allowed_target_class_id: None,
+            grants_permission_inheritance: false,
+            created_at: Utc::now(),
+            source_id: Some("src".to_string()),
+        };
+        assert_eq!(rt.source_id, Some("src".to_string()));
+    }
+
+    #[test]
+    fn test_parsed_ontology_default_empty() {
+        let parsed = ParsedOntology {
+            classes: vec![],
+            properties: vec![],
+            relationship_types: vec![],
+        };
+        assert_eq!(parsed.classes.len(), 0);
+        assert_eq!(parsed.properties.len(), 0);
+        assert_eq!(parsed.relationship_types.len(), 0);
+    }
+
+    #[test]
+    fn test_parsed_class_fields() {
+        let pc = ParsedClass {
+            name: "Mission".to_string(),
+            parent_name: Some("BaseClass".to_string()),
+            description: Some("A mission".to_string()),
+            is_abstract: false,
+            is_system: true,
+        };
+        assert_eq!(pc.name, "Mission");
+        assert_eq!(pc.parent_name, Some("BaseClass".to_string()));
+        assert_eq!(pc.description, Some("A mission".to_string()));
+        assert!(!pc.is_abstract);
+        assert!(pc.is_system);
+    }
+
+    #[test]
+    fn test_import_result_serializes() {
+        let result = ImportResult {
+            source_id: "src-1".to_string(),
+            role: "base".to_string(),
+            imported: ImportStats {
+                classes: 3,
+                properties: 5,
+                relationship_types: 2,
+            },
+            conflicts: vec![],
+            imported_at: Utc::now(),
+        };
+        let json = serde_json::to_value(&result).unwrap();
+        assert!(json.get("source_id").is_some());
+        assert!(json.get("role").is_some());
+        assert!(json.get("imported").is_some());
+        assert!(json.get("conflicts").is_some());
+        assert!(json.get("imported_at").is_some());
+    }
+
+    #[test]
+    fn test_conflict_entry_serializes() {
+        let entry = ConflictEntry {
+            entity_type: "class".to_string(),
+            name: "Mission".to_string(),
+            base_source: "system".to_string(),
+            extension_source: "custom".to_string(),
+        };
+        let json = serde_json::to_value(&entry).unwrap();
+        assert!(json.get("entity_type").is_some());
+        assert!(json.get("name").is_some());
+        assert!(json.get("base_source").is_some());
+        assert!(json.get("extension_source").is_some());
+    }
+
+    #[test]
+    fn test_import_stats_serializes() {
+        let stats = ImportStats {
+            classes: 5,
+            properties: 10,
+            relationship_types: 3,
+        };
+        let json = serde_json::to_value(&stats).unwrap();
+        assert_eq!(json["classes"], 5);
+        assert_eq!(json["properties"], 10);
+        assert_eq!(json["relationship_types"], 3);
+    }
+
+    #[test]
+    fn test_unload_result_serializes() {
+        let result = UnloadResult {
+            source_id: "src-1".to_string(),
+            removed: ImportStats {
+                classes: 2,
+                properties: 4,
+                relationship_types: 1,
+            },
+        };
+        let json = serde_json::to_value(&result).unwrap();
+        assert!(json.get("source_id").is_some());
+        assert!(json.get("removed").is_some());
+    }
+
+    #[test]
+    fn test_import_params_deserialize_role() {
+        let params: ImportParams =
+            serde_urlencoded::from_str("role=base").unwrap();
+        assert_eq!(params.role, Some("base".to_string()));
+    }
+
+    #[test]
+    fn test_import_params_missing_role() {
+        let params: ImportParams = serde_urlencoded::from_str("").unwrap();
+        assert!(params.role.is_none());
+    }
+
+    #[test]
+    fn test_json_classes_file_deserialize() {
+        let json_str = r#"{"classes": [{"name": "Mission", "parent": "Base", "is_abstract": false, "is_system": true, "description": "A mission class"}]}"#;
+        let file: JsonClassesFile = serde_json::from_str(json_str).unwrap();
+        assert_eq!(file.classes.len(), 1);
+        assert_eq!(file.classes[0].name, "Mission");
+        assert_eq!(file.classes[0].parent, Some("Base".to_string()));
+        assert!(file.classes[0].is_system);
+    }
+
+    #[test]
+    fn test_json_properties_file_deserialize() {
+        let json_str = r#"{"properties": {"Mission": [{"name": "priority", "type": "integer", "required": true, "description": "Priority level"}]}}"#;
+        let file: JsonPropertiesFile = serde_json::from_str(json_str).unwrap();
+        assert!(file.properties.contains_key("Mission"));
+        let props = &file.properties["Mission"];
+        assert_eq!(props.len(), 1);
+        assert_eq!(props[0].name, "priority");
+        assert_eq!(props[0].data_type, "integer");
+        assert!(props[0].required);
+    }
+
+    #[test]
+    fn test_json_relationship_types_file_deserialize() {
+        let json_str = r#"{"relationship_types": [{"name": "contains", "description": "Contains relation", "source_class": "Unit", "target_class": "SubUnit", "cardinality": "one:many", "grants_permission_inheritance": true}]}"#;
+        let file: JsonRelationshipTypesFile = serde_json::from_str(json_str).unwrap();
+        assert_eq!(file.relationship_types.len(), 1);
+        let rt = &file.relationship_types[0];
+        assert_eq!(rt.name, "contains");
+        assert_eq!(rt.cardinality, Some("one:many".to_string()));
+        assert!(rt.grants_permission_inheritance);
+    }
+
+    #[test]
+    fn test_import_error_into_response_status_codes() {
+        let cases: Vec<(ImportError, StatusCode)> = vec![
+            (
+                ImportError::IoError(std::io::Error::new(std::io::ErrorKind::Other, "io")),
+                StatusCode::INTERNAL_SERVER_ERROR,
+            ),
+            (
+                ImportError::ParseError("bad".to_string()),
+                StatusCode::BAD_REQUEST,
+            ),
+            (
+                ImportError::NotFound("missing".to_string()),
+                StatusCode::NOT_FOUND,
+            ),
+            (
+                ImportError::InvalidInput("bad input".to_string()),
+                StatusCode::BAD_REQUEST,
+            ),
+            (
+                ImportError::ImportFailed("failed".to_string()),
+                StatusCode::INTERNAL_SERVER_ERROR,
+            ),
+        ];
+
+        for (error, expected_status) in cases {
+            let response = error.into_response();
+            assert_eq!(response.status(), expected_status);
+        }
+    }
+}
diff --git a/backend/src/features/mod.rs b/backend/src/features/mod.rs
index 349af5f..82c8980 100644
--- a/backend/src/features/mod.rs
+++ b/backend/src/features/mod.rs
@@ -6,6 +6,7 @@ pub mod dashboard;
 pub mod discovery;
 pub mod firefighter;
 pub mod navigation;
+pub mod import_engine;
 pub mod ontology;
 pub mod ontology_sources;
 pub mod projects;
diff --git a/backend/src/features/ontology/models.rs b/backend/src/features/ontology/models.rs
index 7139ef9..6edcba5 100644
--- a/backend/src/features/ontology/models.rs
+++ b/backend/src/features/ontology/models.rs
@@ -77,6 +77,8 @@ pub struct ClassWithParent {
     pub is_abstract: bool,
     pub is_deprecated: bool,
     pub created_at: DateTime<Utc>,
+    pub source_id: Option<String>,
+    pub is_system: bool,
 }
 
 #[derive(Debug, Deserialize)]
diff --git a/backend/src/features/ontology/service.rs b/backend/src/features/ontology/service.rs
index edb8690..d4073a4 100644
--- a/backend/src/features/ontology/service.rs
+++ b/backend/src/features/ontology/service.rs
@@ -340,9 +340,10 @@ impl OntologyService {
     ) -> Result<Vec<ClassWithParent>, OntologyError> {
         let classes = sqlx::query_as::<_, ClassWithParent>(
             r#"
-            SELECT c.id, c.name, c.description, c.parent_class_id, 
+            SELECT c.id, c.name, c.description, c.parent_class_id,
                    p.name as parent_class_name, c.version_id,
-                   c.is_abstract, c.is_deprecated, c.created_at
+                   c.is_abstract, c.is_deprecated, c.created_at,
+                   c.source_id, c.is_system
             FROM classes c
             LEFT JOIN classes p ON c.parent_class_id = p.id
             WHERE (c.tenant_id IS NULL OR c.tenant_id = $1)
diff --git a/docs/requirements/02-import-engine/implementation/contracts/section-02-contract.md b/docs/requirements/02-import-engine/implementation/contracts/section-02-contract.md
new file mode 100644
index 0000000..946870c
--- /dev/null
+++ b/docs/requirements/02-import-engine/implementation/contracts/section-02-contract.md
@@ -0,0 +1,28 @@
+# Section 02 — Data Models Prompt Contract
+
+## GOAL
+Define all data models for the import engine: intermediate representation structs, API response structs, file-format deserialization structs, query params, and error types. Update existing ontology models for schema compatibility.
+
+## CONTEXT
+Section 02 of the import engine implementation plan. Depends on section-01 migration (complete). These models are consumed by adapters (section-03), service (section-04), and routes (section-05).
+
+## CONSTRAINTS
+- Follow existing project patterns from `ontology_sources/service.rs` for error handling
+- All new types in `backend/src/features/import_engine/models.rs`
+- Use `thiserror` for error enum, `serde` for serialization
+- Unit tests only (no database) in `#[cfg(test)]` module
+
+## FORMAT
+### Files to Create
+- `backend/src/features/import_engine/mod.rs`
+- `backend/src/features/import_engine/models.rs`
+
+### Files to Modify
+- `backend/src/features/mod.rs` — add `pub mod import_engine;`
+- `backend/src/features/ontology/models.rs` — add `source_id`/`is_system` to `ClassWithParent`
+
+## FAILURE CONDITIONS
+- SHALL NOT break existing tests
+- SHALL NOT modify input structs (CreateClassInput, etc.)
+- SHALL NOT add database dependencies to model tests
+- All 13 unit tests must pass
