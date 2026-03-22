GOAL: Spec must define format adapters for both JSON and JSON-Schema+taxonomy formats, the clean swap mechanism, and the layering/conflict detection logic.
CONSTRAINTS: Must not modify external ontology data repos. Must use source_id from 01. Must be reversible (clean swap).
FAILURE CONDITIONS: SHALL NOT include UI components (that's 03/04). SHALL NOT modify existing ontology data in migrations.
