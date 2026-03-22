# Section 02 — Data Models Prompt Contract

## GOAL
Define all data models for the import engine: intermediate representation structs, API response structs, file-format deserialization structs, query params, and error types. Update existing ontology models for schema compatibility.

## CONTEXT
Section 02 of the import engine implementation plan. Depends on section-01 migration (complete). These models are consumed by adapters (section-03), service (section-04), and routes (section-05).

## CONSTRAINTS
- Follow existing project patterns from `ontology_sources/service.rs` for error handling
- All new types in `backend/src/features/import_engine/models.rs`
- Use `thiserror` for error enum, `serde` for serialization
- Unit tests only (no database) in `#[cfg(test)]` module

## FORMAT
### Files to Create
- `backend/src/features/import_engine/mod.rs`
- `backend/src/features/import_engine/models.rs`

### Files to Modify
- `backend/src/features/mod.rs` — add `pub mod import_engine;`
- `backend/src/features/ontology/models.rs` — add `source_id`/`is_system` to `ClassWithParent`

## FAILURE CONDITIONS
- SHALL NOT break existing tests
- SHALL NOT modify input structs (CreateClassInput, etc.)
- SHALL NOT add database dependencies to model tests
- All 13 unit tests must pass
