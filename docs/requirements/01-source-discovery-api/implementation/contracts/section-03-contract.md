# Section 03 Contract: OntologySourceService

## GOAL
Implement the core business logic service for ontology source discovery and management. The service reads source configuration from the filesystem, handles symlink detection, syncs discovered sources to the database, and manages active base/extension flag assignment using transactions.

## CONTEXT
Section 03 of the Source Discovery API implementation. Depends on section-01 (migration) and section-02 (models). Blocks section-04 (routes) and section-06 (tests).

## CONSTRAINTS
- Follow existing service patterns (OntologyService, ApiManagementService)
- Use `sqlx::Transaction` for atomic flag updates
- Use `tokio::fs` for async filesystem operations
- Use `tokio::time::timeout` for NFS/network mount protection
- Error enum with `thiserror` + `IntoResponse` for Axum
- Service must be `Clone` (Pool is Arc internally)

## FORMAT
Files to create/modify:
- CREATE: `backend/src/features/ontology_sources/service.rs`
- MODIFY: `backend/src/features/ontology_sources/mod.rs` (add module + re-exports)
- MODIFY: `backend/Cargo.toml` (add `tempfile` dev-dependency)
- MODIFY: `backend/tests/ontology_sources_test.rs` (add integration tests)

## FAILURE CONDITIONS
- SHALL NOT skip TDD — tests written before implementation
- SHALL NOT leave compile errors
- SHALL NOT use blocking filesystem calls (must use tokio::fs)
- SHALL NOT allow same source_id as both base and extension
- SHALL NOT panic on missing sources.json — must return Ok(vec![])
