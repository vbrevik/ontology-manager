# Import Engine — Implementation Plan

## Background

The ontology-manager platform manages an EAV (Entity-Attribute-Value) ontology stored in PostgreSQL. Split-01 added a source discovery API that reads `sources.json` and per-source `manifest.json` files, syncs source metadata to an `ontology_sources` table, and manages which source is the active "base" or "extension."

This split (02) builds the **import engine** — the service that actually reads ontology data files from a source directory and loads them into the database tables (`classes`, `properties`, `relationship_types`). It supports two data formats, atomic clean-swap, and conflict detection when layering an extension on top of a base.

The backend is Rust with Axum (0.7), sqlx (0.8, PostgreSQL), tokio, serde, and thiserror. All services are `Clone` (Pool is Arc internally) and passed as Axum `State`.

## What We're Building

### Two REST Endpoints

1. **POST /api/ontology-sources/{id}/import?role=base|extension** — Reads ontology files from a source directory, inserts classes/properties/relationship_types into the database tagged with the source_id. If the source was previously imported, performs a clean swap (delete old, insert new) within a single transaction. If role=extension, auto-detects conflicts against the base source.

2. **DELETE /api/ontology-sources/{id}/import** — Removes all imported data for a source (classes, properties, relationship_types, conflicts) and clears the is_base/is_extension flags. Atomic transaction.

### Two Format Adapters

1. **JSON Adapter** — For the system-ontology format. Reads three flat JSON files: `classes.json`, `properties.json`, `relationship_types.json`. Each file has a simple array/map structure with string-based cross-references (class names, not UUIDs).

2. **JSON Schema + Taxonomy Adapter** — For the MPCG ontology format. Reads `src/taxonomy.json` (hierarchical type tree) and `src/schema.json` (JSON Schema with `$defs` containing enum lists). The taxonomy tree defines classes and relationship types via nested `subtypes` objects. The schema's enum lists determine which types are "active" (non-abstract).

### Supporting Infrastructure

- Database migration adding `is_system` column to `classes` and creating `source_conflicts` table
- **Update existing Rust model structs** — add `source_id: Option<String>` to `Class`, `Property`, `RelationshipType` and `is_system: bool` to `Class` in `ontology/models.rs` (required for `FromRow` compatibility after migration)
- Conflict detection logic that runs automatically on extension imports
- Import result types with statistics and conflict reports

## Architecture

### File Structure

```
backend/src/features/import_engine/
├── mod.rs              -- module declaration + re-exports
├── models.rs           -- ImportResult, ConflictEntry, file-format structs
├── service.rs          -- ImportService: orchestrates resolve → adapt → swap → detect
├── routes.rs           -- POST /import, DELETE /import handlers
├── adapters/
│   ├── mod.rs          -- ImportAdapter trait + dispatch
│   ├── json_adapter.rs -- system-ontology format reader
│   └── schema_adapter.rs -- MPCG JSON Schema + taxonomy reader
└── conflict.rs         -- conflict detection queries + storage
```

### Service Design

`ImportService` holds a `Pool<Postgres>` and a `PathBuf` (data directory, same as OntologySourceService). It follows the same Clone + State pattern as all other services in the codebase.

The import flow:

1. **Resolve** — Query `ontology_sources` table for the source_id. Verify the source exists, read its `path` and `format` fields. Read `manifest.json` from the source directory to get the file mapping.

2. **Adapt** — Based on `format` ("json" or "json-schema"), dispatch to the appropriate adapter. The adapter reads the source files and returns a common intermediate representation: `ParsedOntology { classes, properties, relationship_types }`.

3. **Validate** — Check parsed data integrity: no duplicate class names, no orphan property references (class_name must exist in parsed classes), no orphan relationship type references, no cycles in parent class hierarchy. If role=extension, verify a base source is currently imported (is_base=TRUE, imported_at IS NOT NULL). Validate source directory exists and is readable before attempting file reads.

4. **Swap** — Within a **single transaction** covering steps 4-6: delete any existing rows with this source_id (properties first, then relationship_types, then classes), then insert the new data. Classes and properties get `version_id` from current ontology version; relationship_types do NOT have a version_id column. All rows get the `source_id` tag. Classes use topological sort with **cycle detection** (return ParseError if cycles found).

5. **Detect** — Still within the same transaction: if role=extension, run conflict detection queries against the base source. Store conflicts in `source_conflicts` table.

6. **Finalize** — Still within the same transaction: update the `ontology_sources` row: set `imported_at = NOW()`, set the `is_base` or `is_extension` flag (clearing any previous holder of that flag first). Commit transaction.

## Database Migration

### Add is_system to classes

```sql
ALTER TABLE classes ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE;
```

This maps to the `is_system` field in system-ontology's `classes.json`. MPCG classes default to `false`.

### Create source_conflicts table

```sql
CREATE TABLE source_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_source_id TEXT NOT NULL,
    extension_source_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,        -- 'class', 'property', 'relationship_type'
    entity_name TEXT NOT NULL,
    resolution TEXT,                  -- NULL = unresolved, 'base', 'extension'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_source_conflicts_base ON source_conflicts (base_source_id);
CREATE INDEX idx_source_conflicts_extension ON source_conflicts (extension_source_id);
```

## Data Models

### Intermediate Representation (common across formats)

After parsing, both adapters produce a `ParsedOntology`:

```rust
struct ParsedOntology {
    classes: Vec<ParsedClass>,
    properties: Vec<ParsedProperty>,
    relationship_types: Vec<ParsedRelationshipType>,
}
```

Each parsed type uses **string names** for cross-references (not UUIDs). Name-to-UUID resolution happens during the insert phase.

```rust
struct ParsedClass {
    name: String,
    parent_name: Option<String>,      // resolved to parent_class_id during insert
    description: Option<String>,
    is_abstract: bool,
    is_system: bool,                  // from JSON format; false for MPCG
}

struct ParsedProperty {
    name: String,
    class_name: String,               // resolved to class_id during insert
    data_type: String,                // "string", "integer", etc.
    is_required: bool,
    is_unique: bool,
    is_sensitive: bool,
    description: Option<String>,
    validation_rules: Option<serde_json::Value>,  // enum constraints, etc.
}

struct ParsedRelationshipType {
    name: String,
    description: Option<String>,
    source_class_name: Option<String>,  // resolved to allowed_source_class_id
    target_class_name: Option<String>,  // resolved to allowed_target_class_id
    source_cardinality: String,         // "many", "one"
    target_cardinality: String,
    grants_permission_inheritance: bool,
}
```

### API Response Types

```rust
struct ImportResult {
    source_id: String,
    role: String,                       // "base" or "extension"
    imported: ImportStats,
    conflicts: Vec<ConflictEntry>,
    imported_at: DateTime<Utc>,
}

struct ImportStats {
    classes: usize,
    properties: usize,
    relationship_types: usize,
}

struct ConflictEntry {
    entity_type: String,                // "class", "property", "relationship_type"
    name: String,
    base_source: String,
    extension_source: String,
}

struct UnloadResult {
    source_id: String,
    removed: ImportStats,
}
```

## Adapter Details

### JSON Adapter

Reads three files identified by `manifest.files`:
- `"classes"` → file path for classes.json
- `"properties"` → file path for properties.json
- `"relationship_types"` → file path for relationship_types.json

**classes.json parsing:**
- Top-level: `{"classes": [...]}`
- Each entry: `{name, parent, is_abstract, is_system, description}`
- `parent` is a string name or null → maps to `parent_name` in ParsedClass

**properties.json parsing:**
- Top-level: `{"properties": {"ClassName": [...]}}`
- Map structure keyed by class name
- Each property: `{name, type, required, unique?, sensitive?, description?, enum?}`
- `type` → `data_type`, `required` → `is_required`
- `enum` values → store in `validation_rules` as `{"enum": [...]}`

**relationship_types.json parsing:**
- Top-level: `{"relationship_types": [...]}`
- Each entry: `{name, description, source_class, target_class, cardinality?, grants_permission_inheritance}`
- `cardinality` is a string like "many:one" — split on `:` into source/target cardinality
- `source_class`/`target_class` are string names or null

### JSON Schema + Taxonomy Adapter

Reads two files identified by `manifest.files`:
- `"taxonomy"` → file path for taxonomy.json
- `"schema"` → file path for schema.json

**Step 1: Read schema.json to get active type lists**
- Parse as a JSON Schema document
- Extract `$defs.NodeType.enum` → list of active node type names
- Extract `$defs.EdgeType.enum` → list of active edge type names
- These lists determine which types are non-abstract

**Step 2: Walk taxonomy.json nodeTypes tree → classes**
- Recursive walk of `nodeTypes` object
- Each key is a class name, value has `description` and optional `subtypes`
- Build flat `Vec<ParsedClass>` with parent references
- If name is in the active node types enum → `is_abstract = false`
- If name is NOT in the enum → `is_abstract = true`
- All MPCG classes: `is_system = false`

**Step 3: Extract properties from taxonomy**
- Some taxonomy entries have `property_descriptions: {"field_name": "description"}`
- For each property_description, create a `ParsedProperty`:
  - `class_name` = the taxonomy entry name
  - `data_type` = "string" (default for taxonomy-derived properties)
  - `description` = the property description text
  - If description contains "Constrained vocabulary:" or enum-like list, extract as `validation_rules`

**Step 4: Walk taxonomy.json edgeTypes tree → relationship_types**
- Same recursive walk as nodeTypes
- Each key is a relationship type name
- If in active edge types enum → non-abstract relationship type
- No source/target class constraints (MPCG edge types are generic)
- `source_cardinality` = "many", `target_cardinality` = "many" (default)

## Insert Logic

All inserts happen within a single database transaction (the same transaction that covers delete, conflict detection, and flag updates).

### Pre-Insert Validation

Before starting the transaction, validate the parsed data:
- No duplicate class names within the parsed set
- Every property's `class_name` exists in the parsed classes list
- Every relationship type's `source_class_name` and `target_class_name` (if non-null) exist in parsed classes
- No cycles in parent class hierarchy (topological sort will detect this)

Return `ParseError` with details if validation fails.

### Class Insertion (topological order)

Classes must be inserted parents-before-children because `parent_class_id` is a FK. Build a dependency graph from `parent_name` references and topologically sort. **If a cycle is detected, return ParseError with the offending class names.**

Maintain a `HashMap<String, Uuid>` mapping class name → inserted UUID. For each class:
1. Look up `parent_class_id` from the name map (None if root)
2. Get `version_id` from current ontology version
3. INSERT with `source_id`, `tenant_id = NULL`, `is_system`, `is_abstract`
4. Store the generated UUID in the name map

### Property Insertion

For each property, resolve `class_name` to `class_id` using the name map built during class insertion. INSERT with `version_id` and `source_id`.

### Relationship Type Insertion

For each relationship type, resolve `source_class_name` and `target_class_name` to UUIDs using the name map. INSERT with `source_id`. **Note:** the `relationship_types` table has no `version_id` column — do not include it in the INSERT.

## Conflict Detection

Runs automatically when `role=extension`. After inserting the extension's data:

1. **Class conflicts:** Find classes where a class with the same name exists in both base and extension sources (different source_ids).

2. **Property conflicts:** Find properties where the same property name on the same class name exists in both sources. This requires a JOIN through classes since properties use `class_id` (UUID), not class names: join `properties p1 → classes c1` and `properties p2 → classes c2` where `c1.name = c2.name AND p1.name = p2.name AND p1.source_id = $ext AND p2.source_id = $base`.

3. **Relationship type conflicts:** Find relationship types with the same name in both sources.

Insert each conflict into `source_conflicts` table. Return the conflicts in the API response.

Before detecting new conflicts, delete any existing conflicts for this base+extension pair (in case of re-import).

## Unload (DELETE) Logic

Within a single transaction:
1. DELETE FROM properties WHERE source_id = {id}
2. DELETE FROM relationship_types WHERE source_id = {id}
3. DELETE FROM classes WHERE source_id = {id}
4. DELETE FROM source_conflicts WHERE base_source_id = {id} OR extension_source_id = {id}
5. UPDATE ontology_sources SET is_base = FALSE, is_extension = FALSE, imported_at = NULL WHERE source_id = {id}

Return counts of deleted rows.

## Route Handlers

Two handlers, both requiring JWT auth:

```rust
async fn import_source(
    State(svc): State<ImportService>,
    Path(source_id): Path<String>,
    Query(params): Query<ImportParams>,   // role: Option<String>
) -> Result<Json<ImportResult>, ImportError>
```

```rust
async fn unload_source(
    State(svc): State<ImportService>,
    Path(source_id): Path<String>,
) -> Result<Json<UnloadResult>, ImportError>
```

Route registration follows the existing pattern:
```rust
pub fn import_engine_routes() -> Router<ImportService> {
    Router::new()
        .route("/:id/import", post(import_source).delete(unload_source))
}
```

**Routing merge strategy:** The existing source discovery routes use `Router<OntologySourceService>` and the import routes use `Router<ImportService>`. Since these are different State types, each router must call `.with_state(service)` to produce `Router<()>` before merging. In main.rs, both are nested under `/api/ontology-sources` as merged `Router<()>` sub-routers, with auth + CSRF middleware applied to the combined router.

## Error Handling

`ImportError` enum with thiserror, following SourceError pattern:
- `IoError` → 500
- `ParseError(String)` → 400 (malformed data files)
- `DatabaseError` → 500
- `NotFound(String)` → 404 (source not found)
- `InvalidInput(String)` → 400 (bad role parameter, source not available)
- `ImportFailed(String)` → 500 (transaction failed, already rolled back)

Implements `IntoResponse` for Axum integration.

## Integration Points

### main.rs
- Create `ImportService::new(pool.clone(), PathBuf::from(&config.ontology_data_dir))`
- Nest import routes under `/api/ontology-sources` alongside existing source discovery routes

### TestServices (tests/common/mod.rs)
- Add `import_service: ImportService` field
- Create in `setup_services()` with `PathBuf::from("./test-data")`

### features/mod.rs
- Add `pub mod import_engine;`

## Testing Strategy

### Unit Tests (in-module, no DB)
- **Adapter tests:** Parse sample JSON and taxonomy files from temp directories, verify `ParsedOntology` output
- **Topological sort test:** Verify classes are ordered parents-before-children
- **Cardinality parsing:** "many:one" → ("many", "one")
- **Taxonomy tree flattening:** Verify recursive walk produces correct parent-child relationships

### Integration Tests (sqlx::test, real DB)
- **Import JSON source:** Create temp dir with classes/properties/relationship_types JSON, run import, verify DB rows
- **Import then unload:** Import, verify rows exist, unload, verify rows gone + flags cleared
- **Clean swap (re-import):** Import, re-import with different data, verify old data replaced
- **Conflict detection:** Import base, import extension with overlapping class names, verify conflicts stored
- **Import nonexistent source:** Verify 404 error
- **Import unavailable source:** Source exists in DB but path is broken, verify error
- **Extension without base:** Attempt extension import with no base imported, verify 400 error
- **Re-import base with extension:** Import base, import extension, re-import base — verify conflicts re-detected
- **Cyclic parent references:** Parse classes with A→B→A cycle, verify ParseError
- **Orphan property reference:** Property referencing non-existent class, verify ParseError

### Fixture Strategy
- Use `tempfile::TempDir` with hand-crafted JSON files for unit tests
- For integration tests, insert source rows into `ontology_sources` first, then create temp data directories
