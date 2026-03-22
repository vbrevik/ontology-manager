# Plan Contract

## GOAL
Deliver a self-contained prose blueprint for the Import Engine that covers what to build, why, and how — enabling an engineer or LLM to implement it without prior context.

## CONTEXT
This plan drives all downstream section files and implementation. It must synthesize the spec, research, and interview into a coherent implementation strategy for a Rust/Actix-web backend service.

## CONSTRAINTS
- Plans are prose documents, zero full function implementations
- Must follow existing codebase patterns (Clone services, sqlx, thiserror, Axum routing)
- Must handle two specific data formats with concrete field mappings
- Must be fully self-contained — no assumptions about reader's prior context

## FORMAT
Single file `claude-plan.md` with sections mapping to implementable units:
- Migration, models, adapters, service, routes, tests

## FAILURE CONDITIONS
- SHALL NOT contain full function bodies
- SHALL NOT assume reader has prior context
- SHALL NOT omit testing strategy
- SHALL NOT add features beyond the spec
- SHALL NOT ignore interview decisions (is_system column, import all taxonomy types, auto-conflicts, etc.)
