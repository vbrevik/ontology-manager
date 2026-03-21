<!-- PROJECT_CONFIG
runtime: rust-cargo
test_command: cargo test
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-migration
section-02-models
section-03-service
section-04-routes
section-05-config-integration
section-06-tests
END_MANIFEST -->

# Implementation Sections Index

## Dependency Graph

| Section | Depends On | Blocks | Parallelizable |
|---------|------------|--------|----------------|
| section-01-migration | - | 02, 03, 04, 05, 06 | Yes |
| section-02-models | 01 | 03, 04 | Yes |
| section-03-service | 01, 02 | 04, 06 | No |
| section-04-routes | 02, 03 | 06 | No |
| section-05-config-integration | 01 | 06 | Yes |
| section-06-tests | 01, 02, 03, 04, 05 | - | No |

## Execution Order

1. section-01-migration (no dependencies)
2. section-02-models, section-05-config-integration (parallel after 01)
3. section-03-service (after 01, 02)
4. section-04-routes (after 02, 03)
5. section-06-tests (after all)

## Section Summaries

### section-01-migration
Database migration: create `ontology_sources` table, add `source_id` column to classes/properties/relationship_types, update unique constraints with NULL-safe partial indexes, add source_id indexes.

### section-02-models
Rust data models: `OntologySource` (DB row), `SourcesConfig`/`SourceEntry` (sources.json), `SourceManifest` (manifest.json), `SourceResponse`/`ActiveSourcesResponse`/`SetActiveInput` (API types). Module declaration in mod.rs.

### section-03-service
`OntologySourceService` with discovery logic (filesystem reading, symlink handling, per-source timeout), active source management (transaction-wrapped flag swaps), DB sync (upsert discovered sources). Error enum with thiserror.

### section-04-routes
Router factory `ontology_sources_routes()` with three handlers: `list_sources`, `get_active`, `set_active`. All require JWT auth.

### section-05-config-integration
Add `ontology_data_dir` to Config struct with serde default. Add to `config/default.toml`. Register in `main.rs`: create service, nest routes under `/api/ontology-sources` with auth+CSRF middleware. Update `features/mod.rs`. Update `TestServices` and `create_test_config()`.

### section-06-tests
Full test suite: migration verification (11 tests), model deserialization (5 tests), service unit tests with temp dirs (6 tests), service integration tests with DB (6 tests), route tests (6 tests), config tests (3 tests). Total: ~37 tests.
