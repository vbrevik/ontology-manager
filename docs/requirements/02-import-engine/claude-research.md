# Import Engine Research

## 1. Database Schema

### classes table
```sql
id UUID PK, name VARCHAR(255) NOT NULL, description TEXT,
parent_class_id UUID FK(classes.id), version_id UUID NOT NULL FK(ontology_versions.id),
tenant_id UUID, is_abstract BOOLEAN DEFAULT FALSE, is_deprecated BOOLEAN DEFAULT FALSE,
deprecated_at TIMESTAMPTZ, source_id TEXT, created_at/updated_at TIMESTAMPTZ
```
- Partial unique: `(name, tenant_id, version_id)` WHERE source_id IS NULL (built-in)
- Partial unique: `(name, tenant_id, version_id, source_id)` WHERE source_id IS NOT NULL (imported)

### properties table
```sql
id UUID PK, name VARCHAR(255) NOT NULL, description TEXT,
class_id UUID NOT NULL FK(classes.id), data_type VARCHAR(50) NOT NULL,
reference_class_id UUID FK(classes.id), is_required BOOLEAN DEFAULT FALSE,
is_unique BOOLEAN DEFAULT FALSE, is_indexed BOOLEAN DEFAULT FALSE,
is_sensitive BOOLEAN DEFAULT FALSE, default_value JSONB, validation_rules JSONB,
version_id UUID NOT NULL FK(ontology_versions.id), is_deprecated BOOLEAN DEFAULT FALSE,
source_id TEXT, created_at/updated_at TIMESTAMPTZ
```
- Partial unique: `(name, class_id)` WHERE source_id IS NULL
- Partial unique: `(name, class_id, source_id)` WHERE source_id IS NOT NULL

### relationship_types table
```sql
id UUID PK, name VARCHAR(100) NOT NULL, description TEXT,
source_cardinality VARCHAR(10) DEFAULT 'many', target_cardinality VARCHAR(10) DEFAULT 'many',
allowed_source_class_id UUID FK(classes.id), allowed_target_class_id UUID FK(classes.id),
grants_permission_inheritance BOOLEAN DEFAULT FALSE, source_id TEXT, created_at TIMESTAMPTZ
```
- Partial unique: `(name)` WHERE source_id IS NULL
- Partial unique: `(name, source_id)` WHERE source_id IS NOT NULL

### ontology_sources table
```sql
id UUID PK, source_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
description TEXT, version TEXT, format TEXT NOT NULL, domain TEXT,
path TEXT NOT NULL, is_base BOOLEAN DEFAULT FALSE, is_extension BOOLEAN DEFAULT FALSE,
imported_at TIMESTAMPTZ, stats JSONB, created_at/updated_at TIMESTAMPTZ
```
- At most one base (partial unique on is_base WHERE TRUE)
- At most one extension (partial unique on is_extension WHERE TRUE)
- CHECK: NOT (is_base AND is_extension)

### ontology_versions table
```sql
id UUID PK, version VARCHAR(50) NOT NULL UNIQUE, description TEXT,
is_current BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ, created_by UUID FK(users.id)
```

## 2. Actual Data File Formats

### System Ontology (format: "json")

**classes.json:**
```json
{"$schema": "...", "classes": [
  {"name": "AccessControl", "parent": null, "is_abstract": true, "is_system": true, "description": "..."},
  {"name": "Role", "parent": "AccessControl", "is_abstract": false, "is_system": true, "description": "..."}
]}
```
- 31 classes, hierarchy via `parent` (string name, not UUID)
- Fields: name, parent (nullable string), is_abstract, is_system, description

**properties.json:**
```json
{"$schema": "...", "properties": {
  "Role": [
    {"name": "name", "type": "string", "required": true},
    {"name": "description", "type": "string", "required": false},
    {"name": "level", "type": "integer", "required": true, "description": "..."}
  ],
  "User": [
    {"name": "username", "type": "string", "required": true, "unique": true},
    {"name": "email", "type": "string", "required": true, "unique": true, "sensitive": true}
  ]
}}
```
- 170 properties, keyed by class name
- Fields: name, type, required, unique (optional), sensitive (optional), description (optional), level (optional), enum (optional)
- Types: string, integer, datetime, json, uuid, text, float, boolean, date, number

**relationship_types.json:**
```json
{"$schema": "...", "relationship_types": [
  {"name": "has_role", "description": "...", "source_class": "User", "target_class": "Role",
   "cardinality": "many:one", "grants_permission_inheritance": true}
]}
```
- 19 relationship types
- Fields: name, description, source_class (nullable string), target_class (nullable string), cardinality (optional), grants_permission_inheritance

### MPCG Ontology (format: "json-schema")

**manifest.json files map:** `"schema": "src/schema.json"`, `"taxonomy": "src/taxonomy.json"`

**src/taxonomy.json** (527 lines) — Hierarchical tree:
```json
{"nodeTypes": {
  "Entity": {
    "description": "Anything that exists...",
    "subtypes": {
      "Agent": {
        "description": "Anything capable of autonomous action...",
        "subtypes": {
          "Person": {"description": "Individual human being"},
          "Organization": {"description": "Group...", "subtypes": {
            "NationState": {"description": "Sovereign political entity"}
          }}
        }
      },
      "Object": {"description": "...", "subtypes": {
        "Artifact": {"description": "..."},
        "Resource": {"description": "..."}
      }}
    }
  },
  "Occurrence": {"description": "...", "subtypes": {...}}
},
"edgeTypes": {
  "Causal": {"description": "...", "subtypes": {
    "causes": {"description": "..."},
    "enables": {"description": "..."}
  }}
}}
```
- Node types = classes (90+ types in hierarchy)
- Edge types = relationship_types (25+ types)
- Parent-child via nested `subtypes` objects
- Each node has: description, optional property_descriptions, optional subtypes

**src/schema.json** (784 lines) — JSON Schema 2020-12:
- `$defs.NodeType.enum` = list of active node type names
- `$defs.EdgeType.enum` = list of active edge type names
- `$defs.ContextNode.properties` = node properties (id, type, label, etc.)
- Used to determine which taxonomy types are "active" (non-abstract)

## 3. Existing Service Patterns

### OntologyService
- `#[derive(Clone)]` with `pool: Pool<Postgres>` + `audit_service`
- Creates classes with current version_id, does NOT accept source_id
- Input structs: `CreateClassInput {name, description, parent_class_id, is_abstract}`
- Input structs: `CreatePropertyInput {name, description, class_id, data_type, ...}`
- Uses `sqlx::query_as` with `FromRow` derive

### OntologySourceService
- `#[derive(Clone)]` with `pool: Pool<Postgres>` + `data_dir: PathBuf`
- `discover_from_filesystem()` — static method, reads sources.json + manifests
- `sync_sources_to_db()` — upserts via ON CONFLICT (source_id)
- `set_active_sources()` — transaction-wrapped flag updates
- Error: `SourceError` with thiserror + IntoResponse

### SourceManifest
```rust
pub struct SourceManifest {
    pub name: String, pub version: String, pub description: String,
    #[serde(rename = "type")] pub source_type: String,
    pub format: String,  // "json" or "json-schema"
    pub domain: Option<String>,
    pub files: HashMap<String, String>,  // "classes" -> "classes.json"
    pub stats: Option<serde_json::Value>,
}
```

## 4. Adapter Pattern Recommendation

### Enum-based approach (recommended for 2 formats)
```rust
pub enum ImportFormat {
    Json,       // flat JSON: classes.json, properties.json, relationship_types.json
    JsonSchema, // JSON Schema + taxonomy: schema.json, taxonomy.json
}
```
- Dispatch based on `manifest.format` field ("json" or "json-schema")
- No need for trait objects or async-trait crate with only 2 formats
- Each adapter reads files from the source directory using `manifest.files` map

### Key implementation insight
- The `manifest.files` HashMap maps role names to file paths:
  - JSON format: `{"classes": "classes.json", "properties": "properties.json", "relationship_types": "relationship_types.json"}`
  - JSON Schema format: `{"schema": "src/schema.json", "taxonomy": "src/taxonomy.json"}`
- Use this to resolve which files to read for each format

### Taxonomy tree flattening
- Walk `nodeTypes` recursively, building `Vec<(name, parent_name, description)>`
- Insert in topological order (parents first) to resolve `parent_class_id` FKs
- Use a `HashMap<String, Uuid>` to map class names to IDs during import

## 5. Critical Implementation Notes

### Insert order for referential integrity
1. Classes first (parents before children — topological sort)
2. Properties second (need class_id FK)
3. Relationship types last (need source/target class_id FKs)

### Version management
- All imported classes need a `version_id` — use current version from `ontology_versions WHERE is_current = TRUE`
- `tenant_id` should be NULL for imported ontology data (shared across tenants)

### Clean swap transaction
```sql
BEGIN;
DELETE FROM properties WHERE source_id = $1;
DELETE FROM relationship_types WHERE source_id = $1;
DELETE FROM classes WHERE source_id = $1;
-- INSERT new data
COMMIT;
```
- Delete order: properties first (FK to classes), then relationship_types (FK to classes), then classes

### No `is_system` column in DB
- The `classes` table has `is_abstract` but NOT `is_system`
- The JSON data files have `is_system` but it has no DB column — either ignore or store differently

### Existing Cargo.toml dependencies
Already available: sqlx (postgres, uuid, chrono, json), serde, serde_json, tokio (full), thiserror, uuid, chrono, axum, tempfile (dev)
May need to add: nothing — serde_json handles all JSON Schema parsing needs

## 6. Test Patterns

### Integration tests use `#[sqlx::test]`
- Auto-provisions PostgreSQL, runs all migrations
- Each test gets isolated DB
- Helper: `insert_source(pool, source_id, name)` for seeding ontology_sources rows
- TestServices includes `source_service: OntologySourceService`
- Use `tempfile::TempDir` for filesystem fixtures in unit tests
