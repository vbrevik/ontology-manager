use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use uuid::Uuid;

/// Maps to the `ontology_sources` database table.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OntologySource {
    pub id: Uuid,
    pub source_id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub format: String,
    pub domain: Option<String>,
    pub path: String,
    pub is_base: bool,
    pub is_extension: bool,
    pub imported_at: Option<DateTime<Utc>>,
    pub stats: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Parsed from `data/sources.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourcesConfig {
    pub description: String,
    pub sources: Vec<SourceEntry>,
}

/// A single entry in `sources.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceEntry {
    pub id: String,
    pub path: String,
    pub description: String,
    pub active: bool,
}

/// Parsed from each source's `manifest.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub format: String,
    pub domain: Option<String>,
    pub files: HashMap<String, String>,
    pub stats: Option<serde_json::Value>,
}

/// API response for a single ontology source.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub format: String,
    pub domain: Option<String>,
    pub available: bool,
    pub imported_at: Option<DateTime<Utc>>,
    pub is_base: bool,
    pub is_extension: bool,
    pub stats: Option<serde_json::Value>,
}

/// API response for the currently active sources.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSourcesResponse {
    pub base: Option<SourceResponse>,
    pub extension: Option<SourceResponse>,
}

/// Input payload for PUT /api/ontology-sources/active.
#[derive(Debug, Clone, Deserialize)]
pub struct SetActiveInput {
    pub base: Option<String>,
    pub extension: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sources_config_deserialize() {
        let json = r#"{
            "description": "Available ontology data sources",
            "sources": [
                {
                    "id": "mpcg-ontology",
                    "path": "./mpcg-ontology",
                    "description": "MPCG base ontology",
                    "active": true
                }
            ]
        }"#;
        let config: SourcesConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.sources.len(), 1);
        assert_eq!(config.sources[0].id, "mpcg-ontology");
        assert!(config.sources[0].active);
    }

    #[test]
    fn test_source_manifest_deserialize() {
        let json = r#"{
            "name": "MPCG Ontology",
            "version": "2.0.0",
            "description": "Multi-perspective context ontology",
            "type": "ontology-data-source",
            "format": "json",
            "domain": "military",
            "files": {
                "classes": "classes.json",
                "properties": "properties.json"
            },
            "stats": { "classes": 42, "properties": 128 }
        }"#;
        let manifest: SourceManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.name, "MPCG Ontology");
        assert_eq!(manifest.version, "2.0.0");
        assert_eq!(manifest.source_type, "ontology-data-source");
        assert_eq!(manifest.format, "json");
        assert_eq!(manifest.domain, Some("military".to_string()));
        assert!(manifest.stats.is_some());
    }

    #[test]
    fn test_manifest_with_missing_optional_fields() {
        let json = r#"{
            "name": "Minimal",
            "version": "1.0.0",
            "description": "Minimal manifest",
            "type": "ontology-data-source",
            "format": "json-schema",
            "files": {"schema": "schema.json"}
        }"#;
        let manifest: SourceManifest = serde_json::from_str(json).unwrap();
        assert!(manifest.domain.is_none());
        assert!(manifest.stats.is_none());
    }

    #[test]
    fn test_manifest_files_as_hashmap() {
        let json = r#"{
            "name": "Test",
            "version": "1.0.0",
            "description": "Test",
            "type": "ontology-data-source",
            "format": "json",
            "files": {
                "classes": "classes.json",
                "properties": "properties.json",
                "relationships": "rels.json"
            }
        }"#;
        let manifest: SourceManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.files.get("classes"), Some(&"classes.json".to_string()));
        assert_eq!(manifest.files.get("properties"), Some(&"properties.json".to_string()));
        assert_eq!(manifest.files.len(), 3);
    }

    #[test]
    fn test_source_entry_active_field() {
        let json = r#"{
            "description": "Test",
            "sources": [
                {"id": "a", "path": "./a", "description": "Active", "active": true},
                {"id": "b", "path": "./b", "description": "Inactive", "active": false}
            ]
        }"#;
        let config: SourcesConfig = serde_json::from_str(json).unwrap();
        let active: Vec<_> = config.sources.iter().filter(|s| s.active).collect();
        let inactive: Vec<_> = config.sources.iter().filter(|s| !s.active).collect();
        assert_eq!(active.len(), 1);
        assert_eq!(inactive.len(), 1);
        assert_eq!(active[0].id, "a");
    }
}
