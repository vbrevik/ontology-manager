GOAL: A self-contained prose blueprint for implementing the ontology source discovery API. An engineer with no prior context can implement it from this document alone.

CONTEXT: This is split 01 of 4 in the runtime ontology switching project. It's foundational — splits 02-04 depend on the DB schema changes and API endpoints defined here. The ontology-manager is Rust/Axum with PostgreSQL/SQLx.

CONSTRAINTS:
Always: Follow existing codebase patterns (thiserror, Clone service, Router factory, sqlx::test)
Always: Write for an unfamiliar reader — fully self-contained
Always: Include testing strategy
Ask first: N/A (plan only, no code changes)
Never: Full function implementations — stubs and signatures only
Never: Assume reader has seen spec, interview, or research

FORMAT: Single file claude-plan.md with sections mapping to implementable units.

FAILURE CONDITIONS:
- SHALL NOT contain full function bodies
- SHALL NOT assume reader has prior context
- SHALL NOT omit testing strategy
- SHALL NOT add features beyond the spec
- SHALL NOT include import engine logic (that's split 02)
