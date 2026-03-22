# Section 01: Package Setup — Prompt Contract

## GOAL
Establish the `@mpcg/api` package with Express app factory, middleware stack, server entry point, test infrastructure, and shared test fixtures.

## CONTEXT
This is the foundation section for the MPCG REST API. All subsequent sections (02-08) depend on the package structure, app factory, and test fixtures created here. The API wraps `@mpcg/core` with Express.js for a Vite frontend at localhost:5173.

## CONSTRAINTS
- ESM modules (`"type": "module"`)
- pnpm workspace with `workspace:*` dependency on `@mpcg/core`
- Node's built-in `node:test` + `node:assert/strict` for tests
- `supertest` for HTTP testing
- Express 4.x with `cors` middleware
- `createApp()` factory pattern (no `listen()` in app.js)
- CORS restricted to `http://localhost:5173`
- JSON body limit 5mb (STIG V-222609)
- RFC 7807 format for 404 responses (placeholder error handler)
- STIG V-222610: Error responses must not leak stack traces or file paths

## FORMAT
Files to create:
- `packages/api/package.json`
- `packages/api/app.js`
- `packages/api/server.js`
- `packages/api/tests/helpers/fixtures.js`
- `packages/api/tests/app.test.js`
- `packages/api/routes/` (empty directory)

## FAILURE CONDITIONS
- SHALL NOT call `app.listen()` inside `app.js`
- SHALL NOT use Jest, Mocha, or external test frameworks
- SHALL NOT skip CORS or body size limit middleware
- SHALL NOT return non-JSON error responses
- SHALL NOT expose stack traces in error responses
- SHALL NOT use relative imports for `@mpcg/core` in production code (use workspace package name)
