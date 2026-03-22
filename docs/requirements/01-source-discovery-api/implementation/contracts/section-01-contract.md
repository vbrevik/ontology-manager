GOAL: Create migration adding ontology_sources table, source_id columns, and updated unique constraints. 11 migration verification tests pass.
CONSTRAINTS: Use IF EXISTS/IF NOT EXISTS for idempotency. Partial unique indexes for NULL-safe uniqueness. No foreign key from source_id to ontology_sources.
FAILURE CONDITIONS: SHALL NOT break existing migration tests. SHALL NOT modify existing migration files.
