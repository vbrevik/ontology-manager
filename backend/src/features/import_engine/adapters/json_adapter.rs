use std::path::Path;

use crate::features::import_engine::models::{
    ImportError, JsonClassesFile, JsonPropertiesFile, JsonRelationshipTypesFile, ParsedClass,
    ParsedOntology, ParsedProperty, ParsedRelationshipType,
};
use crate::features::ontology_sources::models::SourceManifest;

/// Parses system-ontology format files from the source directory.
pub async fn parse(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<ParsedOntology, ImportError> {
    let classes = parse_classes(source_dir, manifest).await?;
    let properties = parse_properties(source_dir, manifest).await?;
    let relationship_types = parse_relationship_types(source_dir, manifest).await?;

    Ok(ParsedOntology {
        classes,
        properties,
        relationship_types,
    })
}

async fn parse_classes(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<Vec<ParsedClass>, ImportError> {
    let rel_path = manifest.files.get("classes").ok_or_else(|| {
        ImportError::ParseError("Missing 'classes' key in manifest files".to_string())
    })?;
    let path = source_dir.join(rel_path);
    let content = tokio::fs::read_to_string(&path).await?;
    let file: JsonClassesFile =
        serde_json::from_str(&content).map_err(|e| ImportError::ParseError(e.to_string()))?;

    Ok(file
        .classes
        .into_iter()
        .map(|entry| ParsedClass {
            name: entry.name,
            parent_name: entry.parent,
            description: entry.description,
            is_abstract: entry.is_abstract,
            is_system: entry.is_system,
        })
        .collect())
}

async fn parse_properties(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<Vec<ParsedProperty>, ImportError> {
    let rel_path = manifest.files.get("properties").ok_or_else(|| {
        ImportError::ParseError("Missing 'properties' key in manifest files".to_string())
    })?;
    let path = source_dir.join(rel_path);
    let content = tokio::fs::read_to_string(&path).await?;
    let file: JsonPropertiesFile =
        serde_json::from_str(&content).map_err(|e| ImportError::ParseError(e.to_string()))?;

    let mut properties = Vec::new();
    for (class_name, entries) in file.properties {
        for entry in entries {
            let validation_rules = entry
                .enum_values
                .map(|vals| serde_json::json!({"enum": vals}));

            properties.push(ParsedProperty {
                name: entry.name,
                class_name: class_name.clone(),
                data_type: entry.data_type,
                is_required: entry.required,
                is_unique: entry.unique,
                is_sensitive: entry.sensitive,
                description: entry.description,
                validation_rules,
            });
        }
    }
    Ok(properties)
}

async fn parse_relationship_types(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<Vec<ParsedRelationshipType>, ImportError> {
    let rel_path = manifest.files.get("relationship_types").ok_or_else(|| {
        ImportError::ParseError(
            "Missing 'relationship_types' key in manifest files".to_string(),
        )
    })?;
    let path = source_dir.join(rel_path);
    let content = tokio::fs::read_to_string(&path).await?;
    let file: JsonRelationshipTypesFile =
        serde_json::from_str(&content).map_err(|e| ImportError::ParseError(e.to_string()))?;

    Ok(file
        .relationship_types
        .into_iter()
        .map(|entry| {
            let (source_cardinality, target_cardinality) =
                parse_cardinality(entry.cardinality.as_deref());
            ParsedRelationshipType {
                name: entry.name,
                description: entry.description,
                source_class_name: entry.source_class,
                target_class_name: entry.target_class,
                source_cardinality,
                target_cardinality,
                grants_permission_inheritance: entry.grants_permission_inheritance,
            }
        })
        .collect())
}

fn parse_cardinality(cardinality: Option<&str>) -> (String, String) {
    match cardinality {
        Some(s) if s.contains(':') => {
            let parts: Vec<&str> = s.splitn(2, ':').collect();
            (parts[0].to_string(), parts[1].to_string())
        }
        _ => ("many".to_string(), "many".to_string()),
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
            source_type: "base".to_string(),
            format: "json".to_string(),
            domain: None,
            files,
            stats: None,
        }
    }

    #[tokio::test]
    async fn test_json_parse_classes() {
        let dir = TempDir::new().unwrap();
        let classes_json = r#"{"classes": [
            {"name": "Entity", "is_abstract": true, "is_system": true, "description": "Root"},
            {"name": "Person", "parent": "Entity", "is_abstract": false, "is_system": true},
            {"name": "Unit", "parent": "Entity", "is_abstract": false, "is_system": true, "description": "Military unit"}
        ]}"#;
        std::fs::write(dir.path().join("classes.json"), classes_json).unwrap();

        let mut files = HashMap::new();
        files.insert("classes".to_string(), "classes.json".to_string());
        files.insert("properties".to_string(), "properties.json".to_string());
        files.insert(
            "relationship_types".to_string(),
            "relationship_types.json".to_string(),
        );
        std::fs::write(dir.path().join("properties.json"), r#"{"properties": {}}"#).unwrap();
        std::fs::write(
            dir.path().join("relationship_types.json"),
            r#"{"relationship_types": []}"#,
        )
        .unwrap();

        let manifest = make_manifest(files);
        let result = parse(dir.path(), &manifest).await.unwrap();
        assert_eq!(result.classes.len(), 3);
        assert_eq!(result.classes[0].name, "Entity");
        assert!(result.classes[0].is_abstract);
        assert!(result.classes[0].is_system);
        assert_eq!(result.classes[1].parent_name, Some("Entity".to_string()));
    }

    #[tokio::test]
    async fn test_json_parse_properties() {
        let dir = TempDir::new().unwrap();
        let props_json = r#"{"properties": {
            "Person": [
                {"name": "rank", "type": "string", "required": true, "sensitive": false},
                {"name": "clearance", "type": "string", "required": false, "sensitive": true}
            ],
            "Unit": [
                {"name": "size", "type": "integer", "required": false}
            ]
        }}"#;
        std::fs::write(dir.path().join("properties.json"), props_json).unwrap();

        let mut files = HashMap::new();
        files.insert("properties".to_string(), "properties.json".to_string());
        let manifest = make_manifest(files);
        let result = parse_properties(dir.path(), &manifest).await.unwrap();
        assert_eq!(result.len(), 3);

        let rank = result.iter().find(|p| p.name == "rank").unwrap();
        assert_eq!(rank.class_name, "Person");
        assert!(rank.is_required);

        let clearance = result.iter().find(|p| p.name == "clearance").unwrap();
        assert!(clearance.is_sensitive);
    }

    #[tokio::test]
    async fn test_json_parse_properties_with_enum() {
        let dir = TempDir::new().unwrap();
        let props_json = r#"{"properties": {
            "Unit": [
                {"name": "status", "type": "string", "required": true, "enum": ["ACTIVE", "INACTIVE"]}
            ]
        }}"#;
        std::fs::write(dir.path().join("properties.json"), props_json).unwrap();

        let mut files = HashMap::new();
        files.insert("properties".to_string(), "properties.json".to_string());
        let manifest = make_manifest(files);
        let result = parse_properties(dir.path(), &manifest).await.unwrap();
        assert_eq!(result.len(), 1);

        let status = &result[0];
        let rules = status.validation_rules.as_ref().unwrap();
        let enums = rules["enum"].as_array().unwrap();
        assert_eq!(enums.len(), 2);
        assert_eq!(enums[0], "ACTIVE");
    }

    #[tokio::test]
    async fn test_json_parse_relationship_types() {
        let dir = TempDir::new().unwrap();
        let rt_json = r#"{"relationship_types": [
            {"name": "commands", "source_class": "Person", "target_class": "Unit", "cardinality": "one:many", "grants_permission_inheritance": false},
            {"name": "supports", "description": "Support relation", "cardinality": "many:many", "grants_permission_inheritance": true}
        ]}"#;
        std::fs::write(dir.path().join("relationship_types.json"), rt_json).unwrap();

        let mut files = HashMap::new();
        files.insert(
            "relationship_types".to_string(),
            "relationship_types.json".to_string(),
        );
        let manifest = make_manifest(files);
        let result = parse_relationship_types(dir.path(), &manifest).await.unwrap();
        assert_eq!(result.len(), 2);

        let commands = &result[0];
        assert_eq!(commands.source_class_name, Some("Person".to_string()));
        assert_eq!(commands.target_class_name, Some("Unit".to_string()));
        assert_eq!(commands.source_cardinality, "one");
        assert_eq!(commands.target_cardinality, "many");
    }

    #[test]
    fn test_json_parse_cardinality_split() {
        let (src, tgt) = parse_cardinality(Some("many:one"));
        assert_eq!(src, "many");
        assert_eq!(tgt, "one");
    }

    #[test]
    fn test_json_parse_cardinality_missing() {
        let (src, tgt) = parse_cardinality(None);
        assert_eq!(src, "many");
        assert_eq!(tgt, "many");
    }
}
