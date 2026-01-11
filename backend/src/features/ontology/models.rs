use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

// ============================================================================
// SCHEMA VERSIONING
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "ontology_version_status", rename_all = "UPPERCASE")]
pub enum OntologyVersionStatus {
    DRAFT,
    PUBLISHED,
    ARCHIVED,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "approval_status", rename_all = "UPPERCASE")]
pub enum ApprovalStatus {
    PENDING,
    APPROVED,
    REJECTED,
}

/// Represents a version of the ontology schema
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OntologyVersion {
    pub id: Uuid,
    pub version: String,
    pub description: Option<String>,
    pub status: OntologyVersionStatus,
    pub cloned_from_id: Option<Uuid>,
    pub is_current: bool,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVersionInput {
    pub version: String,
    pub description: Option<String>,
}

// ============================================================================
// CLASS DEFINITIONS
// ============================================================================

/// A class in the ontology schema (e.g., "Mission", "Unit", "Context")
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Class {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub parent_class_id: Option<Uuid>,
    pub version_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub is_abstract: bool,
    pub is_deprecated: bool,
    pub deprecated_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Class with resolved parent name for API responses
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ClassWithParent {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub parent_class_id: Option<Uuid>,
    pub parent_class_name: Option<String>,
    pub version_id: Uuid,
    pub is_abstract: bool,
    pub is_deprecated: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateClassInput {
    pub name: String,
    pub description: Option<String>,
    pub parent_class_id: Option<Uuid>,
    pub is_abstract: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClassInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub parent_class_id: Option<Uuid>,
    pub is_abstract: Option<bool>,
    pub is_deprecated: Option<bool>,
}

// ============================================================================
// PROPERTY DEFINITIONS
// ============================================================================

/// A property belonging to a class
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Property {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub class_id: Uuid,
    pub data_type: String,
    pub reference_class_id: Option<Uuid>,
    pub is_required: bool,
    pub is_unique: bool,
    pub is_indexed: bool,
    pub is_sensitive: bool,
    pub default_value: Option<serde_json::Value>,
    pub validation_rules: Option<serde_json::Value>,
    pub version_id: Uuid,
    pub is_deprecated: bool,
    pub deprecated_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePropertyInput {
    pub name: String,
    pub description: Option<String>,
    pub class_id: Uuid,
    pub data_type: String,
    pub reference_class_id: Option<Uuid>,
    pub is_required: Option<bool>,
    pub is_unique: Option<bool>,
    pub is_indexed: Option<bool>,
    pub is_sensitive: Option<bool>,
    pub default_value: Option<serde_json::Value>,
    pub validation_rules: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePropertyInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub data_type: Option<String>,
    pub reference_class_id: Option<Uuid>,
    pub is_required: Option<bool>,
    pub is_unique: Option<bool>,
    pub is_indexed: Option<bool>,
    pub is_sensitive: Option<bool>,
    pub default_value: Option<serde_json::Value>,
    pub validation_rules: Option<serde_json::Value>,
    pub is_deprecated: Option<bool>,
}

// ============================================================================
// ENTITY INSTANCES
// ============================================================================

/// An instance of a class in the data graph
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Entity {
    pub id: Uuid,
    pub class_id: Uuid,
    pub display_name: String,
    pub parent_entity_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub attributes: serde_json::Value,
    pub approval_status: ApprovalStatus,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<Uuid>,
}

/// Entity with resolved class and parent names
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityWithDetails {
    pub id: Uuid,
    pub class_id: Uuid,
    pub class_name: String,
    pub display_name: String,
    pub parent_entity_id: Option<Uuid>,
    pub parent_entity_name: Option<String>,
    pub attributes: serde_json::Value,
    pub approval_status: ApprovalStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEntityInput {
    pub class_id: Uuid,
    pub display_name: String,
    pub parent_entity_id: Option<Uuid>,
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEntityInput {
    pub display_name: Option<String>,
    pub parent_entity_id: Option<Uuid>,
    pub attributes: Option<serde_json::Value>,
}

// ============================================================================
// RELATIONSHIPS
// ============================================================================

/// A type of relationship between entities
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RelationshipType {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub source_cardinality: Option<String>,
    pub target_cardinality: Option<String>,
    pub allowed_source_class_id: Option<Uuid>,
    pub allowed_target_class_id: Option<Uuid>,
    pub grants_permission_inheritance: bool,
    pub created_at: DateTime<Utc>,
}

/// A relationship instance between two entities
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Relationship {
    pub id: Uuid,
    pub source_entity_id: Uuid,
    pub target_entity_id: Uuid,
    pub relationship_type_id: Uuid,
    pub metadata: Option<serde_json::Value>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Relationship with resolved names
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RelationshipWithDetails {
    pub id: Uuid,
    pub source_entity_id: Uuid,
    pub source_entity_name: String,
    pub target_entity_id: Uuid,
    pub target_entity_name: String,
    pub relationship_type_id: Uuid,
    pub relationship_type_name: String,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRelationshipInput {
    pub source_entity_id: Uuid,
    pub target_entity_id: Uuid,
    pub relationship_type: String,  // Name of the relationship type
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// GRAPH TRAVERSAL RESULTS
// ============================================================================

/// Result from ancestor/descendant queries
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityPathNode {
    pub ancestor_id: Uuid,
    pub ancestor_name: String,
    pub depth: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityDescendantNode {
    pub descendant_id: Uuid,
    pub descendant_name: String,
    pub depth: i32,
}

/// Result from related entities query
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[allow(dead_code)]
pub struct RelatedEntity {
    pub related_entity_id: Uuid,
    pub related_entity_name: String,
    pub relationship_id: Uuid,
    pub relationship_type: String,
    pub direction: String,
}
