# Plan Contract

## GOAL
`claude-plan.md` must deliver a self-contained prose blueprint for implementing the MPCG REST API server (`packages/api/`). It must cover what to build, why, and how — in enough detail for an engineer or LLM to implement without guessing.

## CONTEXT
This plan drives all downstream section files and implementation via `/deep-implement`. The API wraps `@mpcg/core` with Express.js, serving taxonomy, schema, scenarios, validation, graph queries, and constraint data to a Vite frontend at localhost:5173.

## CONSTRAINTS
- Plans are prose documents with minimal code (type definitions, function signatures, API contracts, directory structure only)
- Zero full function implementations — that's deep-implement's job
- Must follow plan-writing.md guidelines
- Must follow existing project conventions: ESM, pnpm workspace, Node's built-in test runner, node:assert/strict
- Must use @mpcg/core exports (not direct file reads) for schema/taxonomy
- Must use Express.js as the framework
- Must use RFC 7807 Problem Details for error responses
- Must use supertest for API integration tests

## FORMAT
Single file `claude-plan.md` with sections that map to implementable units. Each section should be independently implementable by a subagent.

## FAILURE CONDITIONS
- SHALL NOT contain full function bodies
- SHALL NOT assume reader has prior context about the MPCG project
- SHALL NOT omit testing strategy
- SHALL NOT add features beyond the spec
- SHALL NOT use Jest, Mocha, or any external test framework (must use node:test)
- SHALL NOT recommend reading files directly when @mpcg/core exports are available

## STIG Constraints (auto-detected: input-validation, error-handling)

- V-222606 (CAT I): All user-supplied input must be validated server-side (type, length, range, format)
- V-222609 (CAT I): Application must handle malformed, oversized, or unexpected input without crashing or exposing internals
- V-222585 (CAT I): Application must fail to a secure state — deny access on failure rather than defaulting to permissive
- V-222610 (CAT II): Error messages must not contain stack traces, internal paths, or version info
- V-222611 (CAT II): Detailed error information only in server-side logs, not in HTTP responses
