Now I have all the context needed. Let me generate the section content.

# Section 02: Error Handling

## Overview

This section implements the centralized error handling layer for the `@mpcg/api` package. All error responses conform to **RFC 7807 Problem Details** format with `Content-Type: application/problem+json`. The implementation includes an `ApiError` class, a `createProblem` factory function, a 404 handler, and a centralized Express error handler (4-param middleware). STIG compliance controls V-222610, V-222585, and V-222609 are enforced.

**Depends on:** section-01-package-setup (Express app factory, middleware stack, test infrastructure must exist)

**Blocks:** sections 03 through 07 (all route handlers import from `lib/errors.js` and rely on the error handler being mounted)

---

## File to Create

**`/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/lib/errors.js`**

This module exports three things:

1. `ApiError` class
2. `createProblem(status, detail)` factory function
3. `errorHandler(err, req, res, next)` centralized Express error handler

A 404 handler is also exported (or defined inline in `app.js` during route mounting).

---

## Tests First

**File:** `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/tests/errors.test.js`

Tests use `node:test` and `node:assert/strict` with `supertest`. The test file imports `createApp()` and exercises error handling through HTTP requests.

### Test stubs

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { ApiError, createProblem } from '../lib/errors.js';

describe('Error Handling', () => {

  describe('createProblem()', () => {
    it('returns RFC 7807 object with type, title, status, detail', () => {
      /** Call createProblem(404, 'Graph not found').
       *  Assert result has type: "about:blank", title: "Not Found", status: 404,
       *  detail: "Graph not found". */
    });

    it('maps status codes to correct HTTP status text', () => {
      /** Test 400 -> "Bad Request", 500 -> "Internal Server Error", etc. */
    });
  });

  describe('ApiError class', () => {
    it('extends Error with a status property', () => {
      /** new ApiError(400, 'Missing graph') should be instanceof Error,
       *  have .status === 400, .message === 'Missing graph'. */
    });
  });

  describe('centralized error handler (HTTP)', () => {
    it('ApiError with status 400 returns RFC 7807 with status 400', async () => {
      /** Mount a test route that throws new ApiError(400, 'Bad input').
       *  Assert 400 response with { type, title, status: 400, detail: 'Bad input' }. */
    });

    it('ApiError with status 404 returns RFC 7807 with status 404', async () => {
      /** Mount a test route that throws new ApiError(404, 'Not found').
       *  Assert 404 response with matching Problem Details body. */
    });

    it('unhandled errors return 500 with generic message (no stack trace)', async () => {
      /** Mount a test route that throws new Error('secret internal info').
       *  Assert 500 response. Assert detail does NOT contain 'secret internal info'.
       *  Assert detail is a generic message like 'Internal server error'. */
    });

    it('malformed JSON body returns 400 (SyntaxError handling)', async () => {
      /** Send a POST with Content-Type application/json but body '{invalid}'.
       *  Assert 400 response with RFC 7807 format. */
    });

    it('error responses have Content-Type: application/problem+json', async () => {
      /** Send a request to an unknown route (404).
       *  Assert response Content-Type header includes 'application/problem+json'. */
    });

    it('500 error detail does not contain file paths or stack traces (V-222610)', async () => {
      /** Mount a test route that throws Error with a message containing a file path.
       *  Assert the 500 response body does not contain '/' path separators
       *  or 'at ' stack trace lines. Generic message only. */
    });

    it('unknown routes return 404 with RFC 7807 format', async () => {
      /** GET /api/nonexistent.
       *  Assert 404, body has type/title/status/detail fields. */
    });
  });
});
```

### Testing approach for routes that throw

To test the centralized error handler, you need routes that deliberately throw. Two approaches:

1. **Use the 404 handler** -- simply request a nonexistent path. This tests the 404 handler and the RFC 7807 format.
2. **Add a temporary test route** in the test setup that throws specific errors. For example, in the test file create an app via `createApp()`, then add a route like `app.get('/test-error', (req, res) => { throw new ApiError(400, 'test'); })` before passing to supertest. Note: the error handler must be mounted AFTER routes in `app.js`, so adding routes after `createApp()` but before the error handler won't work. Instead, you can use the `express.Router` approach or test via existing routes that trigger errors (e.g., POST `/api/validate` with missing body to trigger a 400).

The recommended approach: test error handling through existing API endpoints. The 404 handler tests unknown-route errors. POSTing malformed JSON to any endpoint tests SyntaxError handling. POSTing with missing required fields tests ApiError(400). For 500 errors, you may need a test-only route injected via `createApp` options or a middleware that forces an error.

---

## Implementation Details

### `createProblem(status, detail)`

```javascript
import { STATUS_CODES } from 'node:http';

/**
 * Create an RFC 7807 Problem Details object.
 * @param {number} status - HTTP status code
 * @param {string} detail - Human-readable explanation
 * @returns {{ type: string, title: string, status: number, detail: string }}
 */
export function createProblem(status, detail) {
  // Use node:http STATUS_CODES to map status number to text (e.g., 404 -> "Not Found")
  // Return { type: "about:blank", title, status, detail }
}
```

- `type` is always `"about:blank"` (RFC 7807 convention for generic HTTP errors)
- `title` comes from `STATUS_CODES[status]` (Node built-in)
- The function does NOT set headers or send responses -- it only creates the object

### `ApiError` class

```javascript
/**
 * Custom error class for API errors with an HTTP status code.
 * Thrown by route handlers; caught by the centralized error handler.
 */
export class ApiError extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} message - Error detail message
   */
  constructor(status, message) {
    // Call super(message), set this.status = status
  }
}
```

### Centralized error handler

```javascript
/**
 * Express 4-param error handler. Must be mounted LAST in the middleware stack.
 * Formats all errors as RFC 7807 Problem Details.
 *
 * Behavior:
 * 1. If res.headersSent, delegate to Express default handler via next(err)
 * 2. If err is ApiError, send RFC 7807 with err.status and err.message as detail
 * 3. If err is SyntaxError with status 400 (from express.json()), send 400
 * 4. Otherwise, send 500 with generic "Internal server error" message
 *
 * STIG V-222610: Never expose stack traces, file paths, or internal details in response
 * STIG V-222585: Always return an error response (deny); never silently continue
 */
export function errorHandler(err, req, res, next) {
  // Implementation follows the 4 cases above
  // Always set Content-Type to 'application/problem+json'
  // Use createProblem() to construct the response body
}
```

Key implementation notes for the error handler:

- **Detecting SyntaxError from express.json():** Check `err instanceof SyntaxError && err.status === 400`. Express's JSON parser attaches a `status` property to the SyntaxError it throws. The detail message can use `err.message` (which says something like "Unexpected token") since this is user-facing parse feedback, not internal info.
- **Setting Content-Type:** Use `res.type('application/problem+json')` or `res.set('Content-Type', 'application/problem+json')` before `res.json()`. Note that `res.json()` normally sets `application/json`, so you must override it.
- **Generic 500 message:** Use exactly `"Internal server error"` as the detail. Do NOT include `err.message`, `err.stack`, or any other error details in the response body. Optionally log the full error to `console.error` for server-side debugging.

### 404 handler

```javascript
/**
 * Catch-all handler for unmatched routes. Returns 404 in RFC 7807 format.
 * Must be mounted after all route handlers but before the error handler.
 */
export function notFoundHandler(req, res) {
  // Use createProblem(404, `Not found: ${req.originalUrl}`)
  // Set Content-Type to 'application/problem+json'
  // Send with res.status(404).json(problem)
}
```

The `req.originalUrl` inclusion is safe (it's user-provided URL, not internal info).

### Integration with app.js

The error handlers must be mounted in `app.js` in this order:

1. All route handlers (`/api/taxonomy`, `/api/scenarios`, etc.)
2. `notFoundHandler` (catches requests that matched no route)
3. `errorHandler` (catches errors thrown or passed via `next(err)`)

In `app.js`, after all `app.use('/api/...', ...)` calls:

```javascript
import { notFoundHandler, errorHandler } from './lib/errors.js';

// ... after all route mounting ...
app.use(notFoundHandler);
app.use(errorHandler);
```

---

## STIG Compliance Summary

| Control | How It Is Met |
|---------|---------------|
| V-222610 | 500 responses use generic `"Internal server error"` detail. No stack traces, no file paths, no internal variable names. |
| V-222585 | The error handler always sends an error response. Unhandled errors produce 500 (fail-closed), never silently succeed. |
| V-222609 | Malformed JSON from `express.json()` is caught as SyntaxError and returned as 400 with a clear detail message. The server does not crash. |

---

## Usage by Downstream Sections

Route handlers in sections 03-07 will use the error handling layer as follows:

```javascript
import { ApiError } from '../lib/errors.js';

// In a route handler:
if (!req.body.graph) {
  throw new ApiError(400, 'Missing required field: graph');
}

// Or for not-found cases:
const graph = graphStore.get(req.params.id);
if (!graph) {
  throw new ApiError(404, `Graph not found: ${req.params.id}`);
}
```

The centralized error handler catches these automatically -- route handlers do not need try/catch blocks for `ApiError` throws (Express catches synchronous throws in route handlers). For async route handlers, errors must be passed via `next(err)` or the route must use an async wrapper.