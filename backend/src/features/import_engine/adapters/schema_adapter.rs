use std::collections::HashSet;
use std::path::Path;

use crate::features::import_engine::models::{
    ImportError, ParsedClass, ParsedOntology, ParsedProperty, ParsedRelationshipType,
};
use crate::features::ontology_sources::models::SourceManifest;

/// Parses MPCG format files (taxonomy.json + schema.json) from the source directory.
pub async fn parse(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<ParsedOntology, ImportError> {
    let schema_path = manifest.files.get("schema").ok_or_else(|| {
        ImportError::ParseError("Missing 'schema' key in manifest files".to_string())
    })?;
    let taxonomy_path = manifest.files.get("taxonomy").ok_or_else(|| {
        ImportError::ParseError("Missing 'taxonomy' key in manifest files".to_string())
    })?;

    // Step 1: Read schema for active type lists
    let schema_content = tokio::fs::read_to_string(source_dir.join(schema_path)).await?;
    let schema: serde_json::Value =
        serde_json::from_str(&schema_content).map_err(|e| ImportError::ParseError(e.to_string()))?;

    let active_node_types = extract_enum_set(&schema, &["$defs", "NodeType", "enum"]);
    let active_edge_types = extract_enum_set(&schema, &["$defs", "EdgeType", "enum"]);

    // Step 2: Read and walk taxonomy
    let taxonomy_content = tokio::fs::read_to_string(source_dir.join(taxonomy_path)).await?;
    let taxonomy: serde_json::Value = serde_json::from_str(&taxonomy_content)
        .map_err(|e| ImportError::ParseError(e.to_string()))?;

    let mut classes = Vec::new();
    let mut properties = Vec::new();
    let mut relationship_types = Vec::new();

    if let Some(node_types) = taxonomy.get("nodeTypes").and_then(|v| v.as_object()) {
        walk_types(
            node_types,
            None,
            &active_node_types,
            &mut classes,
            &mut properties,
        );
    }

    if let Some(edge_types) = taxonomy.get("edgeTypes").and_then(|v| v.as_object()) {
        walk_edge_types(edge_types, &active_edge_types, &mut relationship_types);
    }

    Ok(ParsedOntology {
        classes,
        properties,
        relationship_types,
    })
}

fn extract_enum_set(schema: &serde_json::Value, path: &[&str]) -> HashSet<String> {
    let mut current = schema;
    for key in path {
        match current.get(key) {
            Some(v) => current = v,
            None => return HashSet::new(),
        }
    }
    current
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn walk_types(
    types: &serde_json::Map<String, serde_json::Value>,
    parent_name: Option<&str>,
    active_set: &HashSet<String>,
    classes: &mut Vec<ParsedClass>,
    properties: &mut Vec<ParsedProperty>,
) {
    for (name, value) in types {
        let description = value
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        classes.push(ParsedClass {
            name: name.clone(),
            parent_name: parent_name.map(|s| s.to_string()),
            description,
            is_abstract: !active_set.contains(name.as_str()),
            is_system: false,
        });

        // Extract property_descriptions
        if let Some(prop_descs) = value.get("property_descriptions").and_then(|v| v.as_object()) {
            for (prop_name, prop_desc) in prop_descs {
                let desc_str = prop_desc.as_str().map(|s| s.to_string());
                properties.push(ParsedProperty {
                    name: prop_name.clone(),
                    class_name: name.clone(),
                    data_type: "string".to_string(),
                    is_required: false,
                    is_unique: false,
                    is_sensitive: false,
                    description: desc_str,
                    validation_rules: None,
                });
            }
        }

        // Recurse into subtypes
        if let Some(subtypes) = value.get("subtypes").and_then(|v| v.as_object()) {
            walk_types(subtypes, Some(name), active_set, classes, properties);
        }
    }
}

fn walk_edge_types(
    types: &serde_json::Map<String, serde_json::Value>,
    _active_set: &HashSet<String>,
    relationship_types: &mut Vec<ParsedRelationshipType>,
) {
    for (name, value) in types {
        let description = value
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        relationship_types.push(ParsedRelationshipType {
            name: name.clone(),
            description,
            source_class_name: None,
            target_class_name: None,
            source_cardinality: "many".to_string(),
            target_cardinality: "many".to_string(),
            grants_permission_inheritance: false,
        });

        // Recurse into subtypes if present
        if let Some(subtypes) = value.get("subtypes").and_then(|v| v.as_object()) {
            walk_edge_types(subtypes, _active_set, relationship_types);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tempfile::TempDir;

    fn make_manifest(files: HashMap<String, String>) -> SourceManifest {
        SourceManifest {
            name: "test".to_string(),
            version: "1.0".to_string(),
            description: "test".to_string(),
            source_type: "extension".to_string(),
            format: "json-schema".to_string(),
            domain: None,
            files,
            stats: None,
        }
    }

    fn write_test_files(dir: &Path, schema: &str, taxonomy: &str) -> HashMap<String, String> {
        std::fs::write(dir.join("schema.json"), schema).unwrap();
        std::fs::write(dir.join("taxonomy.json"), taxonomy).unwrap();
        let mut files = HashMap::new();
        files.insert("schema".to_string(), "schema.json".to_string());
        files.insert("taxonomy".to_string(), "taxonomy.json".to_string());
        files
    }

    #[tokio::test]
    async fn test_taxonomy_walk_node_types() {
        let dir = TempDir::new().unwrap();
        let schema = r#"{"$defs": {"NodeType": {"enum": ["Person", "Civilian"]}, "EdgeType": {"enum": []}}}"#;
        let taxonomy = r#"{
            "nodeTypes": {
                "Entity": {
                    "description": "Top-level",
                    "subtypes": {
                        "Person": {
                            "description": "A person",
                            "subtypes": {
                                "Civilian": {"description": "A civilian"}
                            }
                        }
                    }
                }
            },
            "edgeTypes": {}
        }"#;
        let files = write_test_files(dir.path(), schema, taxonomy);
        let manifest = make_manifest(files);
        let result = parse(dir.path(), &manifest).await.unwrap();

        assert_eq!(result.classes.len(), 3);
        let entity = result.classes.iter().find(|c| c.name == "Entity").unwrap();
        assert!(entity.parent_name.is_none());
        assert!(entity.is_abstract); // not in active set

        let person = result.classes.iter().find(|c| c.name == "Person").unwrap();
        assert_eq!(person.parent_name, Some("Entity".to_string()));
        assert!(!person.is_abstract); // in active set

        let civilian = result.classes.iter().find(|c| c.name == "Civilian").unwrap();
        assert_eq!(civilian.parent_name, Some("Person".to_string()));
        assert!(!civilian.is_abstract);
    }

    #[tokio::test]
    async fn test_taxonomy_active_types_from_schema() {
        let dir = TempDir::new().unwrap();
        let schema = r#"{"$defs": {"NodeType": {"enum": ["Person", "Event"]}, "EdgeType": {"enum": []}}}"#;
        let taxonomy = r#"{
            "nodeTypes": {
                "Person": {"description": "A person"},
                "Organization": {"description": "An org"},
                "Event": {"description": "An event"}
            },
            "edgeTypes": {}
        }"#;
        let files = write_test_files(dir.path(), schema, taxonomy);
        let manifest = make_manifest(files);
        let result = parse(dir.path(), &manifest).await.unwrap();

        let person = result.classes.iter().find(|c| c.name == "Person").unwrap();
        assert!(!person.is_abstract);

        let org = result.classes.iter().find(|c| c.name == "Organization").unwrap();
        assert!(org.is_abstract);

        let event = result.classes.iter().find(|c| c.name == "Event").unwrap();
        assert!(!event.is_abstract);
    }

    #[tokio::test]
    async fn test_taxonomy_walk_edge_types() {
        let dir = TempDir::new().unwrap();
        let schema = r#"{"$defs": {"NodeType": {"enum": []}, "EdgeType": {"enum": ["commands"]}}}"#;
        let taxonomy = r#"{
            "nodeTypes": {},
            "edgeTypes": {
                "commands": {"description": "Commands relation"},
                "supports": {"description": "Support relation"}
            }
        }"#;
        let files = write_test_files(dir.path(), schema, taxonomy);
        let manifest = make_manifest(files);
        let result = parse(dir.path(), &manifest).await.unwrap();

        assert_eq!(result.relationship_types.len(), 2);
        let commands = result.relationship_types.iter().find(|r| r.name == "commands").unwrap();
        assert_eq!(commands.source_cardinality, "many");
        assert_eq!(commands.target_cardinality, "many");
    }

    #[tokio::test]
    async fn test_taxonomy_property_descriptions() {
        let dir = TempDir::new().unwrap();
        let schema = r#"{"$defs": {"NodeType": {"enum": ["Unit"]}, "EdgeType": {"enum": []}}}"#;
        let taxonomy = r#"{
            "nodeTypes": {
                "Unit": {
                    "description": "Military unit",
                    "property_descriptions": {
                        "status": "FRIENDLY or HOSTILE"
                    }
                }
            },
            "edgeTypes": {}
        }"#;
        let files = write_test_files(dir.path(), schema, taxonomy);
        let manifest = make_manifest(files);
        let result = parse(dir.path(), &manifest).await.unwrap();

        assert_eq!(result.properties.len(), 1);
        let prop = &result.properties[0];
        assert_eq!(prop.name, "status");
        assert_eq!(prop.class_name, "Unit");
        assert_eq!(prop.data_type, "string");
        assert_eq!(prop.description, Some("FRIENDLY or HOSTILE".to_string()));
    }

    #[tokio::test]
    async fn test_taxonomy_empty_subtypes() {
        let dir = TempDir::new().unwrap();
        let schema = r#"{"$defs": {"NodeType": {"enum": ["Leaf"]}, "EdgeType": {"enum": []}}}"#;
        let taxonomy = r#"{
            "nodeTypes": {
                "Leaf": {"description": "A leaf node"}
            },
            "edgeTypes": {}
        }"#;
        let files = write_test_files(dir.path(), schema, taxonomy);
        let manifest = make_manifest(files);
        let result = parse(dir.path(), &manifest).await.unwrap();

        assert_eq!(result.classes.len(), 1);
        assert_eq!(result.classes[0].name, "Leaf");
        assert!(!result.classes[0].is_abstract);
    }
}
