# Section 03: Format Adapters

## Status: IMPLEMENTED

## Overview

This section implements two format adapters and a common dispatch mechanism for reading ontology data from source directories. The adapters convert source-specific file formats into a common intermediate representation (`ParsedOntology`). Validation (orphan references, duplicate names, cycle detection) is also covered here.

**Dependencies:**
- Section 01 (migration): ✅ complete
- Section 02 (models): ✅ complete

**Blocks:** Section 04 (service), Section 06 (tests)

## Files Created

- `backend/src/features/import_engine/adapters/mod.rs` — dispatch + validation + topological sort
- `backend/src/features/import_engine/adapters/json_adapter.rs` — system-ontology JSON format
- `backend/src/features/import_engine/adapters/schema_adapter.rs` — MPCG taxonomy + JSON Schema format

## Files Modified

- `backend/src/features/import_engine/mod.rs` — added `pub mod adapters;`

## Deviations from Plan

- **Renamed `validate_parsed` → `validate_and_sort`**: Returns sorted `ParsedOntology` instead of `()`, avoiding duplicate sort calls
- **Error accumulation**: Validation collects all errors (duplicates, orphan refs) and returns them joined, rather than failing on first error
- **Added orphan parent class validation**: Classes referencing non-existent parent names are now caught
- **16 adapter tests + 15 model tests = 31 total passing**

## Tests First

All adapter tests are unit tests that use `tempfile::TempDir` and require no database. They belong in `#[cfg(test)] mod tests` blocks within each adapter file.

### JSON Adapter Tests (in `json_adapter.rs`)

#### test_json_parse_classes
Create a temp dir with a `classes.json` file containing 3 classes (1 root, 2 children with parent references). Call the JSON adapter's parse function. Assert that 3 `ParsedClass` values are returned with correct `name`, `parent_name`, `is_system`, `is_abstract`, and `description` fields.

#### test_json_parse_properties
Create a temp dir with a `properties.json` file keyed by 2 class names, each containing an array of property objects. Parse and assert correct `class_name`, `data_type`, `is_required`, `is_sensitive` mappings on the resulting `ParsedProperty` values.

#### test_json_parse_properties_with_enum
Create a property entry with `"enum": ["A", "B"]`. After parsing, assert that the resulting `ParsedProperty` has `validation_rules` containing `{"enum": ["A", "B"]}`.

#### test_json_parse_relationship_types
Create a `relationship_types.json` with 2 entries including `source_class`, `target_class`, and `cardinality` fields. Assert correct mapping to `ParsedRelationshipType` fields.

#### test_json_parse_cardinality_split
Input cardinality string `"many:one"`. Assert `source_cardinality = "many"` and `target_cardinality = "one"`.

#### test_json_parse_cardinality_missing
No cardinality field present on a relationship type entry. Assert defaults to `source_cardinality = "many"` and `target_cardinality = "many"`.

### Schema + Taxonomy Adapter Tests (in `schema_adapter.rs`)

#### test_taxonomy_walk_node_types
Create a `taxonomy.json` with a 3-level `nodeTypes` tree (e.g., Entity with subtypes Person and Organization, where Person has subtype Civilian). Parse and assert that the flat list of `ParsedClass` values has correct `parent_name` references.

#### test_taxonomy_active_types_from_schema
Create a `schema.json` with `$defs.NodeType.enum: ["Person", "Event"]`. Create a taxonomy with Person, Organization, Event as nodeTypes. Assert Person and Event have `is_abstract = false`, Organization has `is_abstract = true`.

#### test_taxonomy_walk_edge_types
Create a `taxonomy.json` with an `edgeTypes` tree. Parse and assert relationship types are created with correct names and default cardinalities (`"many"`, `"many"`).

#### test_taxonomy_property_descriptions
Create a taxonomy entry with `property_descriptions: {"status": "FRIENDLY or HOSTILE"}`. Assert a `ParsedProperty` is created with `class_name` matching the taxonomy entry and `data_type = "string"`.

#### test_taxonomy_empty_subtypes
Create a node in the taxonomy with no `subtypes` key. Assert it parses as a leaf node with no children.

### Validation Tests (in `adapters/mod.rs`)

#### test_topological_sort_basic
Create 3 `ParsedClass` values: A (root), B (parent=A), C (parent=B). Run topological sort. Assert output order is A, B, C.

#### test_topological_sort_cycle_detection
Create 3 `ParsedClass` values forming a cycle: A (parent=C), B (parent=A), C (parent=B). Run topological sort. Assert it returns an error indicating a cycle.

#### test_validate_orphan_property
Create a `ParsedProperty` with `class_name = "Missing"` where no class named "Missing" exists in the parsed classes list. Run validation. Assert it returns a `ParseError`.

#### test_validate_orphan_relationship_type
Create a `ParsedRelationshipType` with `source_class_name = Some("Missing")`. Run validation. Assert it returns a `ParseError`.

#### test_validate_duplicate_class_names
Create two `ParsedClass` values both named "Duplicate". Run validation. Assert it returns a `ParseError`.

## Implementation Details

### adapters/mod.rs -- Dispatch and Validation

This module provides the adapter dispatch function and pre-parse validation logic.

**Dispatch function:**

```rust
/// Reads ontology data files from a source directory and returns a ParsedOntology.
/// Dispatches to the appropriate adapter based on the source format string.
pub async fn parse_source(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<ParsedOntology, ImportError>
```

The function inspects `manifest.format`:
- `"json"` dispatches to `json_adapter::parse`
- `"json-schema"` dispatches to `schema_adapter::parse`
- Any other value returns `ImportError::InvalidInput`

**Validation function:**

```rust
/// Validates a ParsedOntology for internal consistency.
/// Returns Ok(()) or ImportError::ParseError with details.
pub fn validate_parsed(ontology: &ParsedOntology) -> Result<(), ImportError>
```

Checks performed:
1. **Duplicate class names** -- Collect all class names into a `HashSet`. If any name is seen twice, return `ParseError` listing the duplicate.
2. **Orphan property references** -- For each `ParsedProperty`, verify its `class_name` exists in the set of parsed class names. Return `ParseError` with the orphan property name and its missing class reference.
3. **Orphan relationship type references** -- For each `ParsedRelationshipType`, if `source_class_name` or `target_class_name` is `Some(name)`, verify that name exists in the parsed class names. Return `ParseError` with details.
4. **Cycle detection** -- Delegate to `topological_sort` (see below). If it returns an error, propagate it.

**Topological sort:**

```rust
/// Sorts classes in parent-before-child order.
/// Returns Err(ImportError::ParseError) if a cycle is detected.
pub fn topological_sort(classes: &[ParsedClass]) -> Result<Vec<ParsedClass>, ImportError>
```

Algorithm: Build a dependency graph from `parent_name` references. Use Kahn's algorithm (BFS-based topological sort):
1. Build an adjacency list and in-degree count for each class.
2. Start with classes that have no parent (in-degree 0).
3. Process the queue, decrementing in-degrees of children.
4. If the final sorted list has fewer entries than the input, a cycle exists -- return `ParseError` listing the classes still remaining (those form the cycle).

The sorted output is used during the insert phase (Section 04) to ensure parent classes are inserted before their children, satisfying the FK constraint on `parent_class_id`.

### adapters/json_adapter.rs -- JSON Format Adapter

This adapter reads the system-ontology format: three flat JSON files.

```rust
/// Parses system-ontology format files from the source directory.
pub async fn parse(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<ParsedOntology, ImportError>
```

**File resolution:** The adapter looks up file paths from `manifest.files`:
- `manifest.files["classes"]` -- relative path to classes JSON file
- `manifest.files["properties"]` -- relative path to properties JSON file
- `manifest.files["relationship_types"]` -- relative path to relationship types JSON file

Each path is joined with `source_dir` to get the absolute file path. Files are read with `tokio::fs::read_to_string`.

**classes.json format and mapping:**

The file structure is `{"classes": [...]}` where each entry has fields: `name`, `parent` (string or null), `is_abstract` (bool), `is_system` (bool), `description` (string or null).

Define a deserialization struct for the file:

```rust
#[derive(Deserialize)]
struct ClassesFile {
    classes: Vec<JsonClassEntry>,
}

#[derive(Deserialize)]
struct JsonClassEntry {
    name: String,
    parent: Option<String>,
    is_abstract: bool,
    is_system: bool,
    description: Option<String>,
}
```

Map to `ParsedClass`:
- `parent` maps to `parent_name`
- All other fields map directly

**properties.json format and mapping:**

The file structure is `{"properties": {"ClassName": [...]}}` -- a map keyed by class name, each value an array of property objects.

Each property object has: `name`, `type` (string), `required` (bool), `unique` (optional bool), `sensitive` (optional bool), `description` (optional string), `enum` (optional array of strings).

```rust
#[derive(Deserialize)]
struct PropertiesFile {
    properties: HashMap<String, Vec<JsonPropertyEntry>>,
}

#[derive(Deserialize)]
struct JsonPropertyEntry {
    name: String,
    #[serde(rename = "type")]
    data_type: String,
    required: bool,
    unique: Option<bool>,
    sensitive: Option<bool>,
    description: Option<String>,
    #[serde(rename = "enum")]
    enum_values: Option<Vec<String>>,
}
```

Map to `ParsedProperty`:
- The map key becomes `class_name`
- `type` maps to `data_type`
- `required` maps to `is_required`
- `unique` maps to `is_unique` (default `false`)
- `sensitive` maps to `is_sensitive` (default `false`)
- If `enum_values` is present, store as `validation_rules: Some(json!({"enum": enum_values}))`

**relationship_types.json format and mapping:**

The file structure is `{"relationship_types": [...]}` where each entry has: `name`, `description`, `source_class` (string or null), `target_class` (string or null), `cardinality` (optional string like `"many:one"`), `grants_permission_inheritance` (bool).

```rust
#[derive(Deserialize)]
struct RelationshipTypesFile {
    relationship_types: Vec<JsonRelationshipTypeEntry>,
}

#[derive(Deserialize)]
struct JsonRelationshipTypeEntry {
    name: String,
    description: Option<String>,
    source_class: Option<String>,
    target_class: Option<String>,
    cardinality: Option<String>,
    grants_permission_inheritance: bool,
}
```

**Cardinality parsing:** Split the `cardinality` string on `':'`. If present and contains a colon, the left part is `source_cardinality` and the right part is `target_cardinality`. If missing or not splittable, default both to `"many"`.

```rust
fn parse_cardinality(cardinality: Option<&str>) -> (String, String) {
    // Split on ':' or default to ("many", "many")
}
```

### adapters/schema_adapter.rs -- JSON Schema + Taxonomy Adapter

This adapter reads the MPCG ontology format: a taxonomy tree and a JSON Schema document.

```rust
/// Parses MPCG format files (taxonomy.json + schema.json) from the source directory.
pub async fn parse(
    source_dir: &Path,
    manifest: &SourceManifest,
) -> Result<ParsedOntology, ImportError>
```

**File resolution:** From `manifest.files`:
- `manifest.files["taxonomy"]` -- path to taxonomy.json
- `manifest.files["schema"]` -- path to schema.json

**Step 1: Read schema.json for active type lists**

Parse the schema as a generic `serde_json::Value`. Navigate to `$defs.NodeType.enum` to get a `Vec<String>` of active node type names. Navigate to `$defs.EdgeType.enum` to get active edge type names. These lists determine which types are concrete (non-abstract).

The schema structure (relevant parts only):

```json
{
  "$defs": {
    "NodeType": { "enum": ["Person", "Event", ...] },
    "EdgeType": { "enum": ["commands", "supports", ...] }
  }
}
```

Collect both enum arrays into `HashSet<String>` for O(1) lookups during tree walking.

**Step 2: Walk taxonomy.json nodeTypes tree to produce classes**

The taxonomy structure:

```json
{
  "nodeTypes": {
    "Entity": {
      "description": "Top-level entity",
      "subtypes": {
        "Person": {
          "description": "A person",
          "property_descriptions": { "rank": "Military rank" },
          "subtypes": { ... }
        }
      }
    }
  },
  "edgeTypes": { ... }
}
```

Implement a recursive walk function:

```rust
fn walk_types(
    types: &serde_json::Map<String, serde_json::Value>,
    parent_name: Option<&str>,
    active_set: &HashSet<String>,
    classes: &mut Vec<ParsedClass>,
    properties: &mut Vec<ParsedProperty>,
)
```

For each key-value pair in the types map:
- Create a `ParsedClass` with:
  - `name` = the key
  - `parent_name` = the parent parameter
  - `description` = value of `"description"` field if present
  - `is_abstract` = `true` if the name is NOT in `active_set`, `false` if it IS in the set
  - `is_system` = `false` (all MPCG classes)
- If the entry has `"property_descriptions"` (a map of field name to description string), create a `ParsedProperty` for each:
  - `class_name` = the current type name
  - `name` = the property_descriptions key
  - `data_type` = `"string"` (default for taxonomy-derived properties)
  - `description` = the property_descriptions value
  - `is_required` = `false`, `is_unique` = `false`, `is_sensitive` = `false`
  - If description text contains "Constrained vocabulary:" or similar patterns suggesting an enum, optionally extract as `validation_rules`
- If the entry has `"subtypes"`, recursively call `walk_types` with the current type name as parent

**Step 3: Walk edgeTypes tree to produce relationship types**

Same recursive structure but producing `ParsedRelationshipType` values:

```rust
fn walk_edge_types(
    types: &serde_json::Map<String, serde_json::Value>,
    parent_name: Option<&str>,
    active_set: &HashSet<String>,
    relationship_types: &mut Vec<ParsedRelationshipType>,
)
```

For each edge type:
- `name` = the key
- `description` = value of `"description"` field
- `source_class_name` = `None` (MPCG edge types are generic, no class constraints)
- `target_class_name` = `None`
- `source_cardinality` = `"many"`, `target_cardinality` = `"many"` (defaults)
- `grants_permission_inheritance` = `false` (default)
- If in active edge types set, it is a concrete (non-abstract) relationship type; abstract edge types from the taxonomy are still included in the parsed output but marked appropriately

Note: The taxonomy edge types tree does not directly map to abstract/non-abstract in the same way as classes. All edge types found in the taxonomy are included. The `active_set` check can be used for metadata but does not filter out entries.

## Key Design Decisions

1. **Adapters are pure functions, not traits.** Each adapter module exposes a `pub async fn parse(...)` function. The dispatch in `adapters/mod.rs` uses a simple match on the format string. This avoids unnecessary trait complexity since there are only two formats.

2. **Validation is separate from parsing.** The adapters produce raw `ParsedOntology` output. Validation (orphan refs, duplicates, cycles) is a separate step called by the service layer after parsing. This keeps adapter logic focused on format translation.

3. **Topological sort is reused during insert.** The sort function is public so that Section 04 (service) can call it to get classes in insertion order for the FK-safe insert sequence.

4. **All file I/O uses tokio async.** Files are read with `tokio::fs::read_to_string` and deserialized with `serde_json::from_str`. Errors are mapped to `ImportError::IoError` or `ImportError::ParseError`.

5. **The `SourceManifest` type from `ontology_sources::models`** is reused. It already contains the `files: HashMap<String, String>` and `format: String` fields needed by the adapters. Import it from `crate::features::ontology_sources::SourceManifest`.

## Error Handling

- Missing file keys in `manifest.files` (e.g., no `"classes"` key for a JSON format source) return `ImportError::ParseError` with a descriptive message.
- File read failures return `ImportError::IoError`.
- JSON deserialization failures return `ImportError::ParseError`.
- Validation failures (orphans, duplicates, cycles) return `ImportError::ParseError` with details about which entities are problematic.