# Section 03 — Format Adapters Prompt Contract

## GOAL
Implement JSON and JSON Schema+Taxonomy format adapters that convert source files into ParsedOntology, plus validation (orphan refs, duplicates, cycle detection via topological sort).

## CONTEXT
Section 03 of import engine. Adapters are pure async functions, not traits. Dispatch by format string. Validation is separate from parsing. Consumed by service layer (section-04).

## CONSTRAINTS
- Use `SourceManifest` from `crate::features::ontology_sources::models`
- All file I/O via `tokio::fs::read_to_string`
- Unit tests only using `tempfile::TempDir`, no database
- Adapters as module functions, not trait objects

## FORMAT
### Files to Create
- `backend/src/features/import_engine/adapters/mod.rs`
- `backend/src/features/import_engine/adapters/json_adapter.rs`
- `backend/src/features/import_engine/adapters/schema_adapter.rs`

### Files to Modify
- `backend/src/features/import_engine/mod.rs` — add `pub mod adapters;`

## FAILURE CONDITIONS
- SHALL NOT break existing tests
- SHALL NOT add database dependencies
- All unit tests must pass (16 tests specified)
- Topological sort must detect cycles
- Validation must catch orphan references and duplicate names
