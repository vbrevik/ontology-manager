# Import Engine — TDD Plan

## Migration Tests

### test_is_system_column_exists
Verify `is_system` column exists on `classes` table after migration.

### test_is_system_defaults_false
Insert a class without specifying `is_system`. Assert it defaults to `false`.

### test_source_conflicts_table_created
`SELECT * FROM source_conflicts LIMIT 0` should succeed.

### test_source_conflicts_columns
Verify all columns exist: id, base_source_id, extension_source_id, entity_type, entity_name, resolution, created_at.

## Model Tests (unit, no DB)

### test_existing_class_model_has_source_id
Verify `Class` struct includes `source_id: Option<String>` and `is_system: bool`.

## Adapter Unit Tests (tempfile, no DB)

### JSON Adapter

#### test_json_parse_classes
Create temp dir with `classes.json` containing 3 classes (1 root, 2 children). Parse. Assert 3 ParsedClass with correct parent_name and is_system values.

#### test_json_parse_properties
Create temp dir with `properties.json` keyed by 2 class names. Parse. Assert correct class_name, data_type, is_required, is_sensitive mappings.

#### test_json_parse_properties_with_enum
Property with `"enum": ["A", "B"]`. Assert `validation_rules` contains `{"enum": ["A", "B"]}`.

#### test_json_parse_relationship_types
Create `relationship_types.json` with 2 entries. Assert name, source_class_name, target_class_name, cardinality parsing.

#### test_json_parse_cardinality_split
Input: `"cardinality": "many:one"`. Assert source_cardinality="many", target_cardinality="one".

#### test_json_parse_cardinality_missing
No cardinality field. Assert defaults to source="many", target="many".

### Schema + Taxonomy Adapter

#### test_taxonomy_walk_node_types
Create taxonomy.json with 3-level nodeTypes tree. Parse. Assert flat list with correct parent_name references.

#### test_taxonomy_active_types_from_schema
Create schema.json with `$defs.NodeType.enum: ["Person", "Event"]`. Taxonomy has Person, Organization, Event. Assert Person and Event have `is_abstract=false`, Organization has `is_abstract=true`.

#### test_taxonomy_walk_edge_types
Create taxonomy.json with edgeTypes tree. Parse. Assert relationship types created with correct names.

#### test_taxonomy_property_descriptions
Taxonomy entry with `property_descriptions: {"status": "FRIENDLY or HOSTILE"}`. Assert ParsedProperty created with class_name matching the entry.

#### test_taxonomy_empty_subtypes
Node with no subtypes key. Assert it parses as a leaf node with no children.

## Validation Tests (unit, no DB)

#### test_topological_sort_basic
3 classes: A(root), B(parent=A), C(parent=B). Assert sort order: A, B, C.

#### test_topological_sort_cycle_detection
3 classes: A(parent=C), B(parent=A), C(parent=B). Assert ParseError with cycle info.

#### test_validate_orphan_property
Property referencing class "Missing" that doesn't exist in parsed classes. Assert ParseError.

#### test_validate_orphan_relationship_type
Relationship type with source_class="Missing". Assert ParseError.

#### test_validate_duplicate_class_names
Two parsed classes with name "Duplicate". Assert ParseError.

## Service Integration Tests (sqlx::test)

### test_import_json_source
Create temp dir with valid system-ontology JSON files. Insert source row. Call import with role=base. Verify: classes/properties/relationship_types rows exist with correct source_id, ontology_sources.imported_at set, is_base=true.

### test_import_then_unload
Import source. Verify rows. Call unload. Verify: all rows deleted, is_base/is_extension cleared, imported_at=NULL.

### test_clean_swap_reimport
Import source. Re-import same source with modified data. Verify: old data replaced, new data present, no duplicates.

### test_conflict_detection_on_extension
Import base with classes [A, B]. Import extension with classes [B, C]. Verify: conflict detected for class "B", stored in source_conflicts table.

### test_import_nonexistent_source
Call import with source_id that doesn't exist in ontology_sources. Verify 404 error.

### test_import_unavailable_source
Insert source row with broken path. Call import. Verify error (not 500 panic).

### test_extension_without_base
No base source imported. Attempt extension import. Verify 400 error.

### test_reimport_base_with_extension
Import base, import extension (with conflicts), re-import base with different data. Verify conflicts re-detected.

### test_unload_clears_conflicts
Import base. Import extension (creates conflicts). Unload extension. Verify source_conflicts cleared.

### test_import_sets_flags_atomically
Import source as base. Import different source as base. Verify first source's is_base cleared, second source's is_base set.

## Test Fixture Strategy

- **Unit tests:** `tempfile::TempDir` with hand-crafted JSON files written via `std::fs::write`
- **Integration tests:** Insert `ontology_sources` rows directly, create temp data dirs with fixture JSON
- **Minimal fixtures:** 2-3 classes, 2-3 properties, 1-2 relationship types per test (not full 31-class ontology)
