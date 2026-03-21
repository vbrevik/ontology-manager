diff --git a/backend/src/features/import_engine/adapters/json_adapter.rs b/backend/src/features/import_engine/adapters/json_adapter.rs
new file mode 100644
index 0000000..1e6f684
--- /dev/null
+++ b/backend/src/features/import_engine/adapters/json_adapter.rs
@@ -0,0 +1,268 @@
+use std::path::Path;
+
+use crate::features::import_engine::models::{
+    ImportError, JsonClassesFile, JsonPropertiesFile, JsonRelationshipTypesFile, ParsedClass,
+    ParsedOntology, ParsedProperty, ParsedRelationshipType,
+};
+use crate::features::ontology_sources::models::SourceManifest;
+
+/// Parses system-ontology format files from the source directory.
+pub async fn parse(
+    source_dir: &Path,
+    manifest: &SourceManifest,
+) -> Result<ParsedOntology, ImportError> {
+    let classes = parse_classes(source_dir, manifest).await?;
+    let properties = parse_properties(source_dir, manifest).await?;
+    let relationship_types = parse_relationship_types(source_dir, manifest).await?;
+
+    Ok(ParsedOntology {
+        classes,
+        properties,
+        relationship_types,
+    })
+}
+
+async fn parse_classes(
+    source_dir: &Path,
+    manifest: &SourceManifest,
+) -> Result<Vec<ParsedClass>, ImportError> {
+    let rel_path = manifest.files.get("classes").ok_or_else(|| {
+        ImportError::ParseError("Missing 'classes' key in manifest files".to_string())
+    })?;
+    let path = source_dir.join(rel_path);
+    let content = tokio::fs::read_to_string(&path).await?;
+    let file: JsonClassesFile =
+        serde_json::from_str(&content).map_err(|e| ImportError::ParseError(e.to_string()))?;
+
+    Ok(file
+        .classes
+        .into_iter()
+        .map(|entry| ParsedClass {
+            name: entry.name,
+            parent_name: entry.parent,
+            description: entry.description,
+            is_abstract: entry.is_abstract,
+            is_system: entry.is_system,
+        })
+        .collect())
+}
+
+async fn parse_properties(
+    source_dir: &Path,
+    manifest: &SourceManifest,
+) -> Result<Vec<ParsedProperty>, ImportError> {
+    let rel_path = manifest.files.get("properties").ok_or_else(|| {
+        ImportError::ParseError("Missing 'properties' key in manifest files".to_string())
+    })?;
+    let path = source_dir.join(rel_path);
+    let content = tokio::fs::read_to_string(&path).await?;
+    let file: JsonPropertiesFile =
+        serde_json::from_str(&content).map_err(|e| ImportError::ParseError(e.to_string()))?;
+
+    let mut properties = Vec::new();
+    for (class_name, entries) in file.properties {
+        for entry in entries {
+            let validation_rules = entry
+                .enum_values
+                .map(|vals| serde_json::json!({"enum": vals}));
+
+            properties.push(ParsedProperty {
+                name: entry.name,
+                class_name: class_name.clone(),
+                data_type: entry.data_type,
+                is_required: entry.required,
+                is_unique: entry.unique,
+                is_sensitive: entry.sensitive,
+                description: entry.description,
+                validation_rules,
+            });
+        }
+    }
+    Ok(properties)
+}
+
+async fn parse_relationship_types(
+    source_dir: &Path,
+    manifest: &SourceManifest,
+) -> Result<Vec<ParsedRelationshipType>, ImportError> {
+    let rel_path = manifest.files.get("relationship_types").ok_or_else(|| {
+        ImportError::ParseError(
+            "Missing 'relationship_types' key in manifest files".to_string(),
+        )
+    })?;
+    let path = source_dir.join(rel_path);
+    let content = tokio::fs::read_to_string(&path).await?;
+    let file: JsonRelationshipTypesFile =
+        serde_json::from_str(&content).map_err(|e| ImportError::ParseError(e.to_string()))?;
+
+    Ok(file
+        .relationship_types
+        .into_iter()
+        .map(|entry| {
+            let (source_cardinality, target_cardinality) =
+                parse_cardinality(entry.cardinality.as_deref());
+            ParsedRelationshipType {
+                name: entry.name,
+                description: entry.description,
+                source_class_name: entry.source_class,
+                target_class_name: entry.target_class,
+                source_cardinality,
+                target_cardinality,
+                grants_permission_inheritance: entry.grants_permission_inheritance,
+            }
+        })
+        .collect())
+}
+
+fn parse_cardinality(cardinality: Option<&str>) -> (String, String) {
+    match cardinality {
+        Some(s) if s.contains(':') => {
+            let parts: Vec<&str> = s.splitn(2, ':').collect();
+            (parts[0].to_string(), parts[1].to_string())
+        }
+        _ => ("many".to_string(), "many".to_string()),
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use std::collections::HashMap;
+    use tempfile::TempDir;
+
+    fn make_manifest(files: HashMap<String, String>) -> SourceManifest {
+        SourceManifest {
+            name: "test".to_string(),
+            version: "1.0".to_string(),
+            description: "test".to_string(),
+            source_type: "base".to_string(),
+            format: "json".to_string(),
+            domain: None,
+            files,
+            stats: None,
+        }
+    }
+
+    #[tokio::test]
+    async fn test_json_parse_classes() {
+        let dir = TempDir::new().unwrap();
+        let classes_json = r#"{"classes": [
+            {"name": "Entity", "is_abstract": true, "is_system": true, "description": "Root"},
+            {"name": "Person", "parent": "Entity", "is_abstract": false, "is_system": true},
+            {"name": "Unit", "parent": "Entity", "is_abstract": false, "is_system": true, "description": "Military unit"}
+        ]}"#;
+        std::fs::write(dir.path().join("classes.json"), classes_json).unwrap();
+
+        let mut files = HashMap::new();
+        files.insert("classes".to_string(), "classes.json".to_string());
+        files.insert("properties".to_string(), "properties.json".to_string());
+        files.insert(
+            "relationship_types".to_string(),
+            "relationship_types.json".to_string(),
+        );
+        std::fs::write(dir.path().join("properties.json"), r#"{"properties": {}}"#).unwrap();
+        std::fs::write(
+            dir.path().join("relationship_types.json"),
+            r#"{"relationship_types": []}"#,
+        )
+        .unwrap();
+
+        let manifest = make_manifest(files);
+        let result = parse(dir.path(), &manifest).await.unwrap();
+        assert_eq!(result.classes.len(), 3);
+        assert_eq!(result.classes[0].name, "Entity");
+        assert!(result.classes[0].is_abstract);
+        assert!(result.classes[0].is_system);
+        assert_eq!(result.classes[1].parent_name, Some("Entity".to_string()));
+    }
+
+    #[tokio::test]
+    async fn test_json_parse_properties() {
+        let dir = TempDir::new().unwrap();
+        let props_json = r#"{"properties": {
+            "Person": [
+                {"name": "rank", "type": "string", "required": true, "sensitive": false},
+                {"name": "clearance", "type": "string", "required": false, "sensitive": true}
+            ],
+            "Unit": [
+                {"name": "size", "type": "integer", "required": false}
+            ]
+        }}"#;
+        std::fs::write(dir.path().join("properties.json"), props_json).unwrap();
+
+        let mut files = HashMap::new();
+        files.insert("properties".to_string(), "properties.json".to_string());
+        let manifest = make_manifest(files);
+        let result = parse_properties(dir.path(), &manifest).await.unwrap();
+        assert_eq!(result.len(), 3);
+
+        let rank = result.iter().find(|p| p.name == "rank").unwrap();
+        assert_eq!(rank.class_name, "Person");
+        assert!(rank.is_required);
+
+        let clearance = result.iter().find(|p| p.name == "clearance").unwrap();
+        assert!(clearance.is_sensitive);
+    }
+
+    #[tokio::test]
+    async fn test_json_parse_properties_with_enum() {
+        let dir = TempDir::new().unwrap();
+        let props_json = r#"{"properties": {
+            "Unit": [
+                {"name": "status", "type": "string", "required": true, "enum": ["ACTIVE", "INACTIVE"]}
+            ]
+        }}"#;
+        std::fs::write(dir.path().join("properties.json"), props_json).unwrap();
+
+        let mut files = HashMap::new();
+        files.insert("properties".to_string(), "properties.json".to_string());
+        let manifest = make_manifest(files);
+        let result = parse_properties(dir.path(), &manifest).await.unwrap();
+        assert_eq!(result.len(), 1);
+
+        let status = &result[0];
+        let rules = status.validation_rules.as_ref().unwrap();
+        let enums = rules["enum"].as_array().unwrap();
+        assert_eq!(enums.len(), 2);
+        assert_eq!(enums[0], "ACTIVE");
+    }
+
+    #[tokio::test]
+    async fn test_json_parse_relationship_types() {
+        let dir = TempDir::new().unwrap();
+        let rt_json = r#"{"relationship_types": [
+            {"name": "commands", "source_class": "Person", "target_class": "Unit", "cardinality": "one:many", "grants_permission_inheritance": false},
+            {"name": "supports", "description": "Support relation", "cardinality": "many:many", "grants_permission_inheritance": true}
+        ]}"#;
+        std::fs::write(dir.path().join("relationship_types.json"), rt_json).unwrap();
+
+        let mut files = HashMap::new();
+        files.insert(
+            "relationship_types".to_string(),
+            "relationship_types.json".to_string(),
+        );
+        let manifest = make_manifest(files);
+        let result = parse_relationship_types(dir.path(), &manifest).await.unwrap();
+        assert_eq!(result.len(), 2);
+
+        let commands = &result[0];
+        assert_eq!(commands.source_class_name, Some("Person".to_string()));
+        assert_eq!(commands.target_class_name, Some("Unit".to_string()));
+        assert_eq!(commands.source_cardinality, "one");
+        assert_eq!(commands.target_cardinality, "many");
+    }
+
+    #[test]
+    fn test_json_parse_cardinality_split() {
+        let (src, tgt) = parse_cardinality(Some("many:one"));
+        assert_eq!(src, "many");
+        assert_eq!(tgt, "one");
+    }
+
+    #[test]
+    fn test_json_parse_cardinality_missing() {
+        let (src, tgt) = parse_cardinality(None);
+        assert_eq!(src, "many");
+        assert_eq!(tgt, "many");
+    }
+}
diff --git a/backend/src/features/import_engine/adapters/mod.rs b/backend/src/features/import_engine/adapters/mod.rs
new file mode 100644
index 0000000..54e2c62
--- /dev/null
+++ b/backend/src/features/import_engine/adapters/mod.rs
@@ -0,0 +1,232 @@
+pub mod json_adapter;
+pub mod schema_adapter;
+
+use std::collections::{HashMap, HashSet, VecDeque};
+use std::path::Path;
+
+use crate::features::import_engine::models::{ImportError, ParsedClass, ParsedOntology};
+use crate::features::ontology_sources::models::SourceManifest;
+
+/// Reads ontology data files from a source directory and returns a ParsedOntology.
+/// Dispatches to the appropriate adapter based on the source format string.
+pub async fn parse_source(
+    source_dir: &Path,
+    manifest: &SourceManifest,
+) -> Result<ParsedOntology, ImportError> {
+    match manifest.format.as_str() {
+        "json" => json_adapter::parse(source_dir, manifest).await,
+        "json-schema" => schema_adapter::parse(source_dir, manifest).await,
+        other => Err(ImportError::InvalidInput(format!(
+            "Unsupported source format: {}",
+            other
+        ))),
+    }
+}
+
+/// Validates a ParsedOntology for internal consistency.
+pub fn validate_parsed(ontology: &ParsedOntology) -> Result<(), ImportError> {
+    let class_names: Vec<&str> = ontology.classes.iter().map(|c| c.name.as_str()).collect();
+
+    // Check duplicate class names
+    let mut seen = HashSet::new();
+    for name in &class_names {
+        if !seen.insert(*name) {
+            return Err(ImportError::ParseError(format!(
+                "Duplicate class name: {}",
+                name
+            )));
+        }
+    }
+
+    let name_set: HashSet<&str> = seen;
+
+    // Check orphan property references
+    for prop in &ontology.properties {
+        if !name_set.contains(prop.class_name.as_str()) {
+            return Err(ImportError::ParseError(format!(
+                "Property '{}' references unknown class '{}'",
+                prop.name, prop.class_name
+            )));
+        }
+    }
+
+    // Check orphan relationship type references
+    for rt in &ontology.relationship_types {
+        if let Some(ref src) = rt.source_class_name {
+            if !name_set.contains(src.as_str()) {
+                return Err(ImportError::ParseError(format!(
+                    "Relationship type '{}' references unknown source class '{}'",
+                    rt.name, src
+                )));
+            }
+        }
+        if let Some(ref tgt) = rt.target_class_name {
+            if !name_set.contains(tgt.as_str()) {
+                return Err(ImportError::ParseError(format!(
+                    "Relationship type '{}' references unknown target class '{}'",
+                    rt.name, tgt
+                )));
+            }
+        }
+    }
+
+    // Cycle detection via topological sort
+    topological_sort(&ontology.classes)?;
+
+    Ok(())
+}
+
+/// Sorts classes in parent-before-child order using Kahn's algorithm.
+/// Returns Err(ImportError::ParseError) if a cycle is detected.
+pub fn topological_sort(classes: &[ParsedClass]) -> Result<Vec<ParsedClass>, ImportError> {
+    let name_to_idx: HashMap<&str, usize> = classes
+        .iter()
+        .enumerate()
+        .map(|(i, c)| (c.name.as_str(), i))
+        .collect();
+
+    let n = classes.len();
+    let mut in_degree = vec![0usize; n];
+    let mut children: Vec<Vec<usize>> = vec![vec![]; n];
+
+    for (i, class) in classes.iter().enumerate() {
+        if let Some(ref parent) = class.parent_name {
+            if let Some(&parent_idx) = name_to_idx.get(parent.as_str()) {
+                children[parent_idx].push(i);
+                in_degree[i] += 1;
+            }
+            // If parent not in the set, it's an external reference — treat as root
+        }
+    }
+
+    let mut queue: VecDeque<usize> = VecDeque::new();
+    for i in 0..n {
+        if in_degree[i] == 0 {
+            queue.push_back(i);
+        }
+    }
+
+    let mut sorted = Vec::with_capacity(n);
+    while let Some(idx) = queue.pop_front() {
+        sorted.push(classes[idx].clone());
+        for &child_idx in &children[idx] {
+            in_degree[child_idx] -= 1;
+            if in_degree[child_idx] == 0 {
+                queue.push_back(child_idx);
+            }
+        }
+    }
+
+    if sorted.len() < n {
+        let remaining: Vec<&str> = classes
+            .iter()
+            .enumerate()
+            .filter(|(i, _)| in_degree[*i] > 0)
+            .map(|(_, c)| c.name.as_str())
+            .collect();
+        return Err(ImportError::ParseError(format!(
+            "Cycle detected among classes: {}",
+            remaining.join(", ")
+        )));
+    }
+
+    Ok(sorted)
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::features::import_engine::models::{
+        ParsedClass, ParsedOntology, ParsedProperty, ParsedRelationshipType,
+    };
+
+    fn make_class(name: &str, parent: Option<&str>) -> ParsedClass {
+        ParsedClass {
+            name: name.to_string(),
+            parent_name: parent.map(|s| s.to_string()),
+            description: None,
+            is_abstract: false,
+            is_system: false,
+        }
+    }
+
+    #[test]
+    fn test_topological_sort_basic() {
+        let classes = vec![
+            make_class("A", None),
+            make_class("B", Some("A")),
+            make_class("C", Some("B")),
+        ];
+        let sorted = topological_sort(&classes).unwrap();
+        assert_eq!(sorted.len(), 3);
+        assert_eq!(sorted[0].name, "A");
+        assert_eq!(sorted[1].name, "B");
+        assert_eq!(sorted[2].name, "C");
+    }
+
+    #[test]
+    fn test_topological_sort_cycle_detection() {
+        let classes = vec![
+            make_class("A", Some("C")),
+            make_class("B", Some("A")),
+            make_class("C", Some("B")),
+        ];
+        let result = topological_sort(&classes);
+        assert!(result.is_err());
+        let err = result.unwrap_err().to_string();
+        assert!(err.contains("Cycle detected"));
+    }
+
+    #[test]
+    fn test_validate_orphan_property() {
+        let ontology = ParsedOntology {
+            classes: vec![make_class("Real", None)],
+            properties: vec![ParsedProperty {
+                name: "orphan_prop".to_string(),
+                class_name: "Missing".to_string(),
+                data_type: "string".to_string(),
+                is_required: false,
+                is_unique: false,
+                is_sensitive: false,
+                description: None,
+                validation_rules: None,
+            }],
+            relationship_types: vec![],
+        };
+        let result = validate_parsed(&ontology);
+        assert!(result.is_err());
+        assert!(result.unwrap_err().to_string().contains("Missing"));
+    }
+
+    #[test]
+    fn test_validate_orphan_relationship_type() {
+        let ontology = ParsedOntology {
+            classes: vec![make_class("Real", None)],
+            properties: vec![],
+            relationship_types: vec![ParsedRelationshipType {
+                name: "orphan_rel".to_string(),
+                description: None,
+                source_class_name: Some("Missing".to_string()),
+                target_class_name: None,
+                source_cardinality: "many".to_string(),
+                target_cardinality: "many".to_string(),
+                grants_permission_inheritance: false,
+            }],
+        };
+        let result = validate_parsed(&ontology);
+        assert!(result.is_err());
+        assert!(result.unwrap_err().to_string().contains("Missing"));
+    }
+
+    #[test]
+    fn test_validate_duplicate_class_names() {
+        let ontology = ParsedOntology {
+            classes: vec![make_class("Duplicate", None), make_class("Duplicate", None)],
+            properties: vec![],
+            relationship_types: vec![],
+        };
+        let result = validate_parsed(&ontology);
+        assert!(result.is_err());
+        assert!(result.unwrap_err().to_string().contains("Duplicate"));
+    }
+}
diff --git a/backend/src/features/import_engine/adapters/schema_adapter.rs b/backend/src/features/import_engine/adapters/schema_adapter.rs
new file mode 100644
index 0000000..6bd9882
--- /dev/null
+++ b/backend/src/features/import_engine/adapters/schema_adapter.rs
@@ -0,0 +1,308 @@
+use std::collections::HashSet;
+use std::path::Path;
+
+use crate::features::import_engine::models::{
+    ImportError, ParsedClass, ParsedOntology, ParsedProperty, ParsedRelationshipType,
+};
+use crate::features::ontology_sources::models::SourceManifest;
+
+/// Parses MPCG format files (taxonomy.json + schema.json) from the source directory.
+pub async fn parse(
+    source_dir: &Path,
+    manifest: &SourceManifest,
+) -> Result<ParsedOntology, ImportError> {
+    let schema_path = manifest.files.get("schema").ok_or_else(|| {
+        ImportError::ParseError("Missing 'schema' key in manifest files".to_string())
+    })?;
+    let taxonomy_path = manifest.files.get("taxonomy").ok_or_else(|| {
+        ImportError::ParseError("Missing 'taxonomy' key in manifest files".to_string())
+    })?;
+
+    // Step 1: Read schema for active type lists
+    let schema_content = tokio::fs::read_to_string(source_dir.join(schema_path)).await?;
+    let schema: serde_json::Value =
+        serde_json::from_str(&schema_content).map_err(|e| ImportError::ParseError(e.to_string()))?;
+
+    let active_node_types = extract_enum_set(&schema, &["$defs", "NodeType", "enum"]);
+    let active_edge_types = extract_enum_set(&schema, &["$defs", "EdgeType", "enum"]);
+
+    // Step 2: Read and walk taxonomy
+    let taxonomy_content = tokio::fs::read_to_string(source_dir.join(taxonomy_path)).await?;
+    let taxonomy: serde_json::Value = serde_json::from_str(&taxonomy_content)
+        .map_err(|e| ImportError::ParseError(e.to_string()))?;
+
+    let mut classes = Vec::new();
+    let mut properties = Vec::new();
+    let mut relationship_types = Vec::new();
+
+    if let Some(node_types) = taxonomy.get("nodeTypes").and_then(|v| v.as_object()) {
+        walk_types(
+            node_types,
+            None,
+            &active_node_types,
+            &mut classes,
+            &mut properties,
+        );
+    }
+
+    if let Some(edge_types) = taxonomy.get("edgeTypes").and_then(|v| v.as_object()) {
+        walk_edge_types(edge_types, &active_edge_types, &mut relationship_types);
+    }
+
+    Ok(ParsedOntology {
+        classes,
+        properties,
+        relationship_types,
+    })
+}
+
+fn extract_enum_set(schema: &serde_json::Value, path: &[&str]) -> HashSet<String> {
+    let mut current = schema;
+    for key in path {
+        match current.get(key) {
+            Some(v) => current = v,
+            None => return HashSet::new(),
+        }
+    }
+    current
+        .as_array()
+        .map(|arr| {
+            arr.iter()
+                .filter_map(|v| v.as_str().map(|s| s.to_string()))
+                .collect()
+        })
+        .unwrap_or_default()
+}
+
+fn walk_types(
+    types: &serde_json::Map<String, serde_json::Value>,
+    parent_name: Option<&str>,
+    active_set: &HashSet<String>,
+    classes: &mut Vec<ParsedClass>,
+    properties: &mut Vec<ParsedProperty>,
+) {
+    for (name, value) in types {
+        let description = value
+            .get("description")
+            .and_then(|v| v.as_str())
+            .map(|s| s.to_string());
+
+        classes.push(ParsedClass {
+            name: name.clone(),
+            parent_name: parent_name.map(|s| s.to_string()),
+            description,
+            is_abstract: !active_set.contains(name.as_str()),
+            is_system: false,
+        });
+
+        // Extract property_descriptions
+        if let Some(prop_descs) = value.get("property_descriptions").and_then(|v| v.as_object()) {
+            for (prop_name, prop_desc) in prop_descs {
+                let desc_str = prop_desc.as_str().map(|s| s.to_string());
+                properties.push(ParsedProperty {
+                    name: prop_name.clone(),
+                    class_name: name.clone(),
+                    data_type: "string".to_string(),
+                    is_required: false,
+                    is_unique: false,
+                    is_sensitive: false,
+                    description: desc_str,
+                    validation_rules: None,
+                });
+            }
+        }
+
+        // Recurse into subtypes
+        if let Some(subtypes) = value.get("subtypes").and_then(|v| v.as_object()) {
+            walk_types(subtypes, Some(name), active_set, classes, properties);
+        }
+    }
+}
+
+fn walk_edge_types(
+    types: &serde_json::Map<String, serde_json::Value>,
+    _active_set: &HashSet<String>,
+    relationship_types: &mut Vec<ParsedRelationshipType>,
+) {
+    for (name, value) in types {
+        let description = value
+            .get("description")
+            .and_then(|v| v.as_str())
+            .map(|s| s.to_string());
+
+        relationship_types.push(ParsedRelationshipType {
+            name: name.clone(),
+            description,
+            source_class_name: None,
+            target_class_name: None,
+            source_cardinality: "many".to_string(),
+            target_cardinality: "many".to_string(),
+            grants_permission_inheritance: false,
+        });
+
+        // Recurse into subtypes if present
+        if let Some(subtypes) = value.get("subtypes").and_then(|v| v.as_object()) {
+            walk_edge_types(subtypes, _active_set, relationship_types);
+        }
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use std::collections::HashMap;
+    use tempfile::TempDir;
+
+    fn make_manifest(files: HashMap<String, String>) -> SourceManifest {
+        SourceManifest {
+            name: "test".to_string(),
+            version: "1.0".to_string(),
+            description: "test".to_string(),
+            source_type: "extension".to_string(),
+            format: "json-schema".to_string(),
+            domain: None,
+            files,
+            stats: None,
+        }
+    }
+
+    fn write_test_files(dir: &Path, schema: &str, taxonomy: &str) -> HashMap<String, String> {
+        std::fs::write(dir.join("schema.json"), schema).unwrap();
+        std::fs::write(dir.join("taxonomy.json"), taxonomy).unwrap();
+        let mut files = HashMap::new();
+        files.insert("schema".to_string(), "schema.json".to_string());
+        files.insert("taxonomy".to_string(), "taxonomy.json".to_string());
+        files
+    }
+
+    #[tokio::test]
+    async fn test_taxonomy_walk_node_types() {
+        let dir = TempDir::new().unwrap();
+        let schema = r#"{"$defs": {"NodeType": {"enum": ["Person", "Civilian"]}, "EdgeType": {"enum": []}}}"#;
+        let taxonomy = r#"{
+            "nodeTypes": {
+                "Entity": {
+                    "description": "Top-level",
+                    "subtypes": {
+                        "Person": {
+                            "description": "A person",
+                            "subtypes": {
+                                "Civilian": {"description": "A civilian"}
+                            }
+                        }
+                    }
+                }
+            },
+            "edgeTypes": {}
+        }"#;
+        let files = write_test_files(dir.path(), schema, taxonomy);
+        let manifest = make_manifest(files);
+        let result = parse(dir.path(), &manifest).await.unwrap();
+
+        assert_eq!(result.classes.len(), 3);
+        let entity = result.classes.iter().find(|c| c.name == "Entity").unwrap();
+        assert!(entity.parent_name.is_none());
+        assert!(entity.is_abstract); // not in active set
+
+        let person = result.classes.iter().find(|c| c.name == "Person").unwrap();
+        assert_eq!(person.parent_name, Some("Entity".to_string()));
+        assert!(!person.is_abstract); // in active set
+
+        let civilian = result.classes.iter().find(|c| c.name == "Civilian").unwrap();
+        assert_eq!(civilian.parent_name, Some("Person".to_string()));
+        assert!(!civilian.is_abstract);
+    }
+
+    #[tokio::test]
+    async fn test_taxonomy_active_types_from_schema() {
+        let dir = TempDir::new().unwrap();
+        let schema = r#"{"$defs": {"NodeType": {"enum": ["Person", "Event"]}, "EdgeType": {"enum": []}}}"#;
+        let taxonomy = r#"{
+            "nodeTypes": {
+                "Person": {"description": "A person"},
+                "Organization": {"description": "An org"},
+                "Event": {"description": "An event"}
+            },
+            "edgeTypes": {}
+        }"#;
+        let files = write_test_files(dir.path(), schema, taxonomy);
+        let manifest = make_manifest(files);
+        let result = parse(dir.path(), &manifest).await.unwrap();
+
+        let person = result.classes.iter().find(|c| c.name == "Person").unwrap();
+        assert!(!person.is_abstract);
+
+        let org = result.classes.iter().find(|c| c.name == "Organization").unwrap();
+        assert!(org.is_abstract);
+
+        let event = result.classes.iter().find(|c| c.name == "Event").unwrap();
+        assert!(!event.is_abstract);
+    }
+
+    #[tokio::test]
+    async fn test_taxonomy_walk_edge_types() {
+        let dir = TempDir::new().unwrap();
+        let schema = r#"{"$defs": {"NodeType": {"enum": []}, "EdgeType": {"enum": ["commands"]}}}"#;
+        let taxonomy = r#"{
+            "nodeTypes": {},
+            "edgeTypes": {
+                "commands": {"description": "Commands relation"},
+                "supports": {"description": "Support relation"}
+            }
+        }"#;
+        let files = write_test_files(dir.path(), schema, taxonomy);
+        let manifest = make_manifest(files);
+        let result = parse(dir.path(), &manifest).await.unwrap();
+
+        assert_eq!(result.relationship_types.len(), 2);
+        let commands = result.relationship_types.iter().find(|r| r.name == "commands").unwrap();
+        assert_eq!(commands.source_cardinality, "many");
+        assert_eq!(commands.target_cardinality, "many");
+    }
+
+    #[tokio::test]
+    async fn test_taxonomy_property_descriptions() {
+        let dir = TempDir::new().unwrap();
+        let schema = r#"{"$defs": {"NodeType": {"enum": ["Unit"]}, "EdgeType": {"enum": []}}}"#;
+        let taxonomy = r#"{
+            "nodeTypes": {
+                "Unit": {
+                    "description": "Military unit",
+                    "property_descriptions": {
+                        "status": "FRIENDLY or HOSTILE"
+                    }
+                }
+            },
+            "edgeTypes": {}
+        }"#;
+        let files = write_test_files(dir.path(), schema, taxonomy);
+        let manifest = make_manifest(files);
+        let result = parse(dir.path(), &manifest).await.unwrap();
+
+        assert_eq!(result.properties.len(), 1);
+        let prop = &result.properties[0];
+        assert_eq!(prop.name, "status");
+        assert_eq!(prop.class_name, "Unit");
+        assert_eq!(prop.data_type, "string");
+        assert_eq!(prop.description, Some("FRIENDLY or HOSTILE".to_string()));
+    }
+
+    #[tokio::test]
+    async fn test_taxonomy_empty_subtypes() {
+        let dir = TempDir::new().unwrap();
+        let schema = r#"{"$defs": {"NodeType": {"enum": ["Leaf"]}, "EdgeType": {"enum": []}}}"#;
+        let taxonomy = r#"{
+            "nodeTypes": {
+                "Leaf": {"description": "A leaf node"}
+            },
+            "edgeTypes": {}
+        }"#;
+        let files = write_test_files(dir.path(), schema, taxonomy);
+        let manifest = make_manifest(files);
+        let result = parse(dir.path(), &manifest).await.unwrap();
+
+        assert_eq!(result.classes.len(), 1);
+        assert_eq!(result.classes[0].name, "Leaf");
+        assert!(!result.classes[0].is_abstract);
+    }
+}
diff --git a/backend/src/features/import_engine/mod.rs b/backend/src/features/import_engine/mod.rs
index 7d7ac16..a1a5656 100644
--- a/backend/src/features/import_engine/mod.rs
+++ b/backend/src/features/import_engine/mod.rs
@@ -1,3 +1,4 @@
+pub mod adapters;
 pub mod models;
 
 pub use models::*;
diff --git a/docs/requirements/02-import-engine/implementation/contracts/section-03-contract.md b/docs/requirements/02-import-engine/implementation/contracts/section-03-contract.md
new file mode 100644
index 0000000..b3a7fef
--- /dev/null
+++ b/docs/requirements/02-import-engine/implementation/contracts/section-03-contract.md
@@ -0,0 +1,29 @@
+# Section 03 — Format Adapters Prompt Contract
+
+## GOAL
+Implement JSON and JSON Schema+Taxonomy format adapters that convert source files into ParsedOntology, plus validation (orphan refs, duplicates, cycle detection via topological sort).
+
+## CONTEXT
+Section 03 of import engine. Adapters are pure async functions, not traits. Dispatch by format string. Validation is separate from parsing. Consumed by service layer (section-04).
+
+## CONSTRAINTS
+- Use `SourceManifest` from `crate::features::ontology_sources::models`
+- All file I/O via `tokio::fs::read_to_string`
+- Unit tests only using `tempfile::TempDir`, no database
+- Adapters as module functions, not trait objects
+
+## FORMAT
+### Files to Create
+- `backend/src/features/import_engine/adapters/mod.rs`
+- `backend/src/features/import_engine/adapters/json_adapter.rs`
+- `backend/src/features/import_engine/adapters/schema_adapter.rs`
+
+### Files to Modify
+- `backend/src/features/import_engine/mod.rs` — add `pub mod adapters;`
+
+## FAILURE CONDITIONS
+- SHALL NOT break existing tests
+- SHALL NOT add database dependencies
+- All unit tests must pass (16 tests specified)
+- Topological sort must detect cycles
+- Validation must catch orphan references and duplicate names
