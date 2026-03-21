GOAL: Spec must define the API endpoint for discovering ontology sources, the DB schema changes (source_id tagging), and the active source persistence mechanism.
CONSTRAINTS: Must not change existing migration files. Must work with current PostgreSQL schema. Must handle missing/broken symlinks gracefully.
FAILURE CONDITIONS: SHALL NOT duplicate content from other split specs. SHALL NOT include import logic (that's 02).
