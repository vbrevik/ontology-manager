<!-- PROJECT_CONFIG
runtime: rust-cargo
test_command: cargo test
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-migration
section-02-models
section-03-adapters
section-04-service
section-05-routes-integration
section-06-tests
END_MANIFEST -->

# Implementation Sections Index

## Dependency Graph

| Section | Depends On | Blocks | Parallelizable |
|---------|------------|--------|----------------|
| section-01-migration | - | 02, 03, 04, 05, 06 | Yes |
| section-02-models | 01 | 03, 04, 05 | Yes |
| section-03-adapters | 01, 02 | 04, 06 | No |
| section-04-service | 02, 03 | 05, 06 | No |
| section-05-routes-integration | 02, 04 | 06 | No |
| section-06-tests | 01, 02, 03, 04, 05 | - | No |

## Execution Order

1. section-01-migration (no dependencies)
2. section-02-models (after 01)
3. section-03-adapters (after 01, 02)
4. section-04-service (after 02, 03)
5. section-05-routes-integration (after 02, 04)
6. section-06-tests (after all)

## Section Summaries

### section-01-migration
Database migration: add `is_system BOOLEAN NOT NULL DEFAULT FALSE` to `classes` table, create `source_conflicts` table with indexes. Update existing Rust model structs (`Class`, `Property`, `RelationshipType`) to include `source_id` and `is_system` fields for `FromRow` compatibility.

### section-02-models
Data models for the import engine: `ParsedOntology`, `ParsedClass`, `ParsedProperty`, `ParsedRelationshipType` (intermediate representation), `ImportResult`, `ImportStats`, `ConflictEntry`, `UnloadResult` (API responses), `ImportError` enum with `IntoResponse`, file-format deserialization structs for both JSON and JSON Schema formats, `ImportParams` query struct.

### section-03-adapters
Two format adapters behind a common dispatch: JSON adapter (reads classes.json, properties.json, relationship_types.json with field mapping and cardinality parsing) and Schema+Taxonomy adapter (recursive tree walking, active type determination from `$defs` enums, property_descriptions extraction). Pre-parse validation (orphan refs, duplicate names, cycle detection via topological sort).

### section-04-service
`ImportService` with the core import orchestration: resolve source → dispatch adapter → validate → transaction (clean swap delete + insert in topological order + conflict detection + flag updates). Unload logic. All within atomic transactions.

### section-05-routes-integration
Router factory `import_engine_routes()` with POST /{id}/import and DELETE /{id}/import handlers. Route merging with OntologySourceService (different State types → merge as Router<()>). Registration in main.rs, features/mod.rs, TestServices update.

### section-06-tests
Full test suite: migration verification, adapter unit tests with temp fixtures, validation tests (cycles, orphans, duplicates), service integration tests (import/unload/clean swap/conflicts), error case tests.
