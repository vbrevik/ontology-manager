Now I have all the context needed. Here is the section content.

# Section 01: Package Setup

## Overview

This section establishes the `@mpcg/api` package foundation: the `package.json`, Express app factory (`app.js`), server entry point (`server.js`), middleware stack, test infrastructure, and shared test fixtures. All subsequent sections depend on this one.

**Plan sections covered:** 2 (Project Structure), 3 (Package Configuration), 4 (App Factory & Middleware)

**Dependencies:** None (this is the first section)

**Blocks:** All other sections

---

## File Structure

After completing this section, the following files will exist:

```
packages/api/
├── package.json
├── app.js               # Express app factory (createApp)
├── server.js            # Entry point: imports app, calls listen()
├── routes/              # Empty directory (populated by later sections)
└── tests/
    └── helpers/
        └── fixtures.js  # Shared test graph factories
```

---

## Tests First

All tests use `node:test`, `node:assert/strict`, and `supertest`. Tests go in `packages/api/tests/`.

### File: `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/tests/app.test.js`

This file validates the app factory and middleware stack. Test stubs:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';

describe('createApp', () => {
  it('returns an Express app instance');
  // Verify that the return value has .listen, .use, etc.

  it('accepts injected graphStore Map via options');
  // Pass { graphStore: new Map() }, confirm it is used (detailed verification in section-06)

  it('CORS allows requests from http://localhost:5173');
  // Make a request with Origin header set to http://localhost:5173
  // Assert response includes Access-Control-Allow-Origin: http://localhost:5173

  it('CORS rejects requests from other origins');
  // Make a request with Origin: http://evil.com
  // Assert Access-Control-Allow-Origin header is absent

  it('express.json() parses valid JSON bodies');
  // POST a valid JSON body to any endpoint, confirm it is parsed (not a string)

  it('oversized payloads (>5mb) are rejected');
  // POST a body larger than 5mb, expect 413 or 400 status

  it('unknown routes return 404 with RFC 7807 format');
  // GET /api/nonexistent, assert 404 response with { type, title, status, detail }
});
```

**Note on CORS testing:** supertest runs in-process so CORS headers are still set on responses. Check the `access-control-allow-origin` response header value.

**Note on 404/error format:** The 404 handler and error handler middleware are part of this section. The RFC 7807 error factory (`lib/errors.js`) is implemented in section-02. For this section, use a minimal placeholder that returns `{ type: "about:blank", title: "Not Found", status: 404, detail }` so the 404 handler works. Section-02 will flesh this out fully.

---

## Implementation Details

### 1. package.json

**File:** `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/package.json`

```json
{
  "name": "@mpcg/api",
  "version": "1.0.0",
  "description": "REST API server wrapping @mpcg/core for the MPCG web frontend",
  "type": "module",
  "private": true,
  "main": "server.js",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "@mpcg/core": "workspace:*",
    "express": "^4.21.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

**Key points:**
- `"type": "module"` enables ESM imports (matching `@mpcg/core`)
- `@mpcg/core` is a workspace dependency via `workspace:*`
- No `uuid` package needed -- Node 20+ has `crypto.randomUUID()` built-in
- The `pnpm-workspace.yaml` at project root already has `packages/*` glob, so `packages/api` is auto-discovered

After creating this file, run `pnpm install` from the project root to link workspace packages.

### 2. app.js -- Express App Factory

**File:** `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/app.js`

The `createApp(options?)` function creates and returns a configured Express application. It does NOT call `listen()` -- that separation allows supertest to work without a running server.

**Function signature:**

```javascript
/**
 * Creates a configured Express application.
 * @param {object} [options]
 * @param {Map} [options.graphStore] - Injectable Map for graph storage (defaults to new Map())
 * @param {string} [options.scenarioDir] - Path to scenarios directory
 * @returns {import('express').Express}
 */
export function createApp(options = {})
```

**Middleware stack (applied in this order):**

1. **CORS** -- `cors({ origin: 'http://localhost:5173' })`. This restricts cross-origin access to the Vite dev server.

2. **JSON body parsing** -- `express.json({ limit: '5mb' })`. Graphs can be moderately large. The 5mb limit prevents oversized payloads (STIG V-222609).

3. **Route mounting** -- Mount routers at their respective paths. In this section, no routes are registered yet (later sections add them). The app factory should be structured so routes can be added without modifying the factory. The recommended approach: import and mount route modules conditionally, or structure so later sections add `app.use('/api/taxonomy', taxonomyRouter)` calls inside the factory.

4. **404 handler** -- A middleware after all routes that catches unmatched requests and returns an RFC 7807 response with status 404.

5. **Centralized error handler** -- A 4-parameter Express middleware `(err, req, res, next)`. This is a placeholder in this section; section-02 replaces it with the full implementation. For now, it should at minimum return a JSON error response with status 500 for unexpected errors.

**Configuration via environment variables:**
- `PORT` -- defaults to `3001`
- `MPCG_PROJECT_DIR` -- defaults to `path.resolve(import.meta.dirname, '../../')` (project root relative to `packages/api/`)

The `graphStore` and `scenarioDir` should be attached to `app.locals` or similar so route handlers can access them.

### 3. server.js -- Entry Point

**File:** `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/server.js`

This file is minimal:

```javascript
import { createApp } from './app.js';

const port = process.env.PORT || 3001;
const app = createApp();

app.listen(port, () => {
  console.log(`MPCG API listening on http://localhost:${port}`);
});
```

Tests never import `server.js` -- they import `createApp` from `app.js` directly.

### 4. Shared Test Fixtures

**File:** `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/tests/helpers/fixtures.js`

This module provides factory functions that create minimal but valid MPCG graph inputs. These are used across multiple test files in later sections.

**Exported functions (stubs with docstrings):**

```javascript
import crypto from 'node:crypto';

/**
 * Creates a minimal valid MPCG graph input.
 * Contains at least two nodes and one edge with valid types.
 * @param {object} [overrides] - Properties to merge/override on the graph
 * @returns {object} A valid graph input object with { id, nodes, edges }
 */
export function makeValidGraph(overrides = {}) { /* ... */ }

/**
 * Creates a graph input that will fail validation.
 * Uses an invalid node type to trigger a schema error.
 * @returns {object} An invalid graph input object
 */
export function makeInvalidGraph() { /* ... */ }

/**
 * Creates a valid graph containing contradicting belief edges.
 * Two agents with contradictory beliefs about the same claim node.
 * @returns {object} A valid graph with contradiction-producing edges
 */
export function makeGraphWithContradictions() { /* ... */ }

/**
 * Creates a valid graph with belief edges from a specific agent.
 * @returns {{ graph: object, agentId: string }} Graph and the agent's node ID
 */
export function makeGraphWithBeliefs() { /* ... */ }
```

**Important details for building these fixtures:**

- Each graph needs an `id` field (use `crypto.randomUUID()`)
- Each node needs `{ id, type, label }` at minimum, where `type` is a valid node type from `@mpcg/core`'s `nodeTypes` (e.g., `"Person"`, `"Organization"`, `"Claim"`)
- Each edge needs `{ id, source, target, type }` where `type` is a valid edge type from `@mpcg/core`'s `edgeTypes` (e.g., `"believes"`, `"causes"`, `"contradicts"`)
- The `source` and `target` fields on edges must reference valid node IDs within the same graph
- For `makeGraphWithContradictions()`, include two nodes connected by a `"contradicts"` edge type, or two belief edges from different agents about the same claim with conflicting stance
- For `makeGraphWithBeliefs()`, include an Agent-type node with `"believes"` edges pointing to other nodes

### 5. Route Placeholder Structure

Create the empty `routes/` directory so the project structure is in place for subsequent sections:

```
packages/api/routes/     (empty directory)
```

Later sections will add `taxonomy.js`, `scenarios.js`, `validate.js`, `graph.js`, and `constraints.js` here.

---

## Verification Checklist

After implementing this section, confirm:

1. `pnpm install` from project root succeeds and `@mpcg/api` appears in the workspace
2. `@mpcg/core` is importable from within `packages/api/` (run `node -e "import('@mpcg/core').then(m => console.log(Object.keys(m)))"` from `packages/api/`)
3. `pnpm --filter @mpcg/api test` runs the test suite (tests in `tests/app.test.js`)
4. `createApp()` returns a working Express app that supertest can drive
5. CORS headers are set correctly for `http://localhost:5173`
6. Unknown routes return 404 with a JSON body containing `type`, `title`, `status`, `detail`
7. The `server.js` entry point starts the server on port 3001 when run directly

---

## Post-Implementation Notes

**Implemented:** 2026-03-21

### Files Created
- `packages/api/package.json` — as specified
- `packages/api/app.js` — Express app factory with createApp(options)
- `packages/api/server.js` — minimal entry point
- `packages/api/tests/app.test.js` — 7 tests, all passing
- `packages/api/tests/helpers/fixtures.js` — 4 factory functions (makeValidGraph, makeInvalidGraph, makeGraphWithContradictions, makeGraphWithBeliefs)
- `packages/api/routes/` — empty directory (populated by sections 03-07)

### Deviations from Plan
- **JSON parsing test approach:** Could not add dynamic routes after createApp() due to 404 handler ordering. Instead, tested JSON parsing implicitly: valid JSON gets 404 (parsed correctly), malformed JSON gets 400 (parser active). Oversized payload gets 413.
- **CORS rejection test:** The `cors` package with a string origin reflects the configured origin on all responses. Test uses `notStrictEqual` to verify evil origin isn't reflected.
- **Error handler (placeholder):** Uses generic status-based titles instead of err.message to prevent STIG V-222610 information disclosure. Section-02 will replace this with the full ApiError-based handler.
- **MPCG_PROJECT_DIR:** Added environment variable support (defaulting to project root) and set on `app.locals.projectDir`. `scenarioDir` defaults to `resolve(projectDir, 'scenarios')`.

### Test Results
- 7 tests, 7 passing
- Coverage: app factory, graphStore injection, CORS allow/reject, JSON parsing, oversized payload, 404 format