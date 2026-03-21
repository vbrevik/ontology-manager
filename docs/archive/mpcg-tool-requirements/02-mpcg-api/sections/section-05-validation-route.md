I have all the context needed. Here is the section content.

# Section 05: Validation Route

## Overview

This section implements the `POST /api/validate` endpoint and its corresponding test file. The endpoint accepts a graph in the request body, delegates validation to `@mpcg/core`'s `validate()` function, and returns the validation result. It does not store the graph -- that is the responsibility of the graph routes (section 06).

## Dependencies

- **section-01-package-setup**: `createApp()` factory, supertest infrastructure, shared test fixtures in `tests/helpers/fixtures.js`
- **section-02-error-handling**: `ApiError` class from `lib/errors.js` for throwing 400 errors on invalid input
- **@mpcg/core**: The `validate` function exported from the core package

## Files to Create

| File | Purpose |
|------|---------|
| `packages/api/routes/validate.js` | Express router for POST /api/validate |
| `packages/api/tests/validate.test.js` | Test suite for the validation route |

## Files to Modify

| File | Change |
|------|--------|
| `packages/api/app.js` | Mount the validate router at `/api/validate` |

---

## Tests First

File: `packages/api/tests/validate.test.js`

The test file imports `createApp` from the app factory and uses `supertest` for HTTP assertions. It relies on the `makeValidGraph()` and `makeInvalidGraph()` helpers from `tests/helpers/fixtures.js` (created in section 01).

Test stubs to implement:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
// Import shared fixtures from section-01
import { makeValidGraph, makeInvalidGraph } from './helpers/fixtures.js';

describe('POST /api/validate', () => {
  /** POST with valid graph returns { valid: true } */

  /** POST with invalid graph returns { valid: false, errors: [...] } */

  /** POST with missing graph property returns 400 */

  /** POST with null graph returns 400 */

  /** POST with malformed JSON returns 400 */

  /** Response includes stats object */

  /** Validation does not store the graph (GET /api/graph/:id returns 404 afterward) */
});
```

### Test descriptions and expected behavior

1. **POST with valid graph returns `{ valid: true }`** -- Send `{ graph: makeValidGraph() }` and assert response status is 200, body has `valid: true`, and `errors` is an empty array.

2. **POST with invalid graph returns `{ valid: false, errors: [...] }`** -- Send `{ graph: makeInvalidGraph() }` and assert response status is 200 (validation itself succeeds; the graph is just invalid), body has `valid: false`, and `errors` is a non-empty array.

3. **POST with missing graph property returns 400** -- Send `{}` as the body. Assert 400 status and RFC 7807 format with `Content-Type: application/problem+json`.

4. **POST with null graph returns 400** -- Send `{ graph: null }`. Assert 400 status. This is the V-222606 input validation check -- null is not a valid graph object.

5. **POST with malformed JSON returns 400** -- Send a raw string of invalid JSON. Assert 400 status. This is handled by the centralized error handler (section 02) catching the `SyntaxError` from `express.json()`.

6. **Response includes stats object** -- Send a valid graph and assert the response body contains a `stats` property with numeric fields: `nodes`, `edges`, `nodeTypes`, `edgeTypes`.

7. **Validation does not store the graph** -- After validating a graph, attempt `GET /api/graph/{graph.id}/stats` and confirm it returns 404. This verifies the validate endpoint is stateless.

### Fixture shapes

The `makeValidGraph()` fixture should produce a minimal valid MPCG graph. Based on the core package's test patterns, a valid graph looks like:

```javascript
{
  id: '<uuid>',
  domain: 'test',
  perspective: { agent_id: 'test-agent' },
  nodes: [
    { id: '<uuid>', type: 'Person', label: 'Alice' },
    { id: '<uuid>', type: 'Event', label: 'Meeting' }
  ],
  edges: [
    { source: '<node1-id>', target: '<node2-id>', type: 'participates_in' }
  ]
}
```

The `makeInvalidGraph()` fixture should produce a graph that fails validation -- for example, a graph with nodes that have invalid types or edges referencing non-existent node IDs.

---

## Implementation

### Route: `packages/api/routes/validate.js`

This module exports a function that creates and returns an Express `Router`. The router handles a single endpoint.

#### POST /api/validate

Request body shape: `{ graph: MPCGGraphInput }`

Processing steps:

1. **Input validation** -- Check that `req.body.graph` exists and is a non-null object. If missing or null, throw `new ApiError(400, 'Request body must include a "graph" property')`. This satisfies STIG V-222606 (input validation).

2. **Delegate to core** -- Call `validate(req.body.graph)` from `@mpcg/core`. This function returns `{ valid, errors, warnings, stats }`.

3. **Return result** -- Send the `ValidationResult` object directly as the response with status 200. The response is always 200 regardless of whether the graph is valid or not -- the `valid` boolean in the body communicates validation status.

The route does NOT store the graph in the graph store. It is purely a stateless validation check.

#### Router structure

```javascript
import { Router } from 'express';
import { validate } from '@mpcg/core';
import { ApiError } from '../lib/errors.js';

/**
 * Creates the validation route handler.
 * @returns {Router}
 */
export default function createValidateRouter() {
  const router = Router();

  router.post('/', (req, res, next) => {
    // 1. Input validation
    // 2. Call validate(req.body.graph)
    // 3. res.json(result)
  });

  return router;
}
```

### Mounting in app.js

In the `createApp()` function, import and mount the validate router:

```javascript
import createValidateRouter from './routes/validate.js';

// Inside createApp():
app.use('/api/validate', createValidateRouter());
```

This should be added alongside the other route mounts, before the 404 handler and centralized error handler.

### Error handling

- Missing or null `graph` property: Throw `ApiError(400, ...)` which the centralized error handler (section 02) formats as RFC 7807.
- Malformed JSON body: Already handled by the centralized error handler catching `SyntaxError` from `express.json()` middleware.
- Unexpected errors from `validate()`: Caught by the centralized error handler and returned as 500 with a generic message (no stack trace per V-222610).

### Key design note: 200 for invalid graphs

The validate endpoint returns HTTP 200 even when the graph fails validation. The HTTP status reflects whether the API call succeeded, not whether the graph is valid. The `valid: false` field in the response body communicates validation failure. Only malformed requests (missing body, null graph) return 4xx status codes.