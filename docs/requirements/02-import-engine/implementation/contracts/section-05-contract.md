# Section 05 — Routes and Integration Prompt Contract

## GOAL
Wire import engine into application: route handlers, router factory, main.rs integration, test harness update.

## CONSTRAINTS
- Follow ontology_sources/routes.rs pattern
- Merge import routes with source routes under /ontology-sources
- Must compile and pass existing tests

## FORMAT
### Files to Create
- `backend/src/features/import_engine/routes.rs`

### Files to Modify
- `backend/src/features/import_engine/mod.rs` — add routes module
- `backend/src/main.rs` — create ImportService, merge routes
- `backend/tests/common/mod.rs` — add import_service to TestServices

## FAILURE CONDITIONS
- SHALL NOT break existing tests
- SHALL compile successfully
- cargo test must pass
