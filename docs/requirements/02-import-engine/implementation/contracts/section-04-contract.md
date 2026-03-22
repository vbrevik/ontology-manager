# Section 04 — ImportService Prompt Contract

## GOAL
Implement ImportService with import_source (parse, validate, clean-swap transaction, conflict detection, flag management) and unload_source (delete data, clear flags, remove conflicts).

## CONTEXT
Section 04 of import engine. Core orchestration layer that ties adapters (section-03) to database operations. Integration tests are in section-06; this section focuses on service implementation with compile-time verification.

## CONSTRAINTS
- Follow OntologySourceService pattern (Clone, Pool<Postgres>, PathBuf)
- Single transaction for delete-insert-detect-finalize
- Topological sort before transaction (no CPU work holding tx open)
- Name-to-UUID resolution via in-memory HashMap
- Clean swap (delete + insert), not upsert

## FORMAT
### Files to Create
- `backend/src/features/import_engine/service.rs`

### Files to Modify
- `backend/src/features/import_engine/mod.rs` — add `pub mod service;`

## FAILURE CONDITIONS
- SHALL NOT break existing tests
- SHALL compile successfully
- SHALL use transactions for atomicity
- SHALL validate role parameter
- SHALL check base exists before extension import
