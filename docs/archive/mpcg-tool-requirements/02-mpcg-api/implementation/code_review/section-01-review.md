# Section 01 Code Review

## MUST FIX

### 1. Error handler leaks err.message for non-500 errors (STIG V-222610)
File: `packages/api/app.js` — error handler middleware.
For non-500 status codes, `err.message` is used directly in title/detail. Express body-parser errors can contain file paths or internal details in their message property.
Recommendation: Use generic descriptions based on status code, at least until section-02 provides the full error factory.

### 2. No Content-Type header assertion on 404 response
File: `packages/api/tests/app.test.js` — unknown routes test.
The test does not assert Content-Type is JSON. Contract says "SHALL NOT return non-JSON error responses."
Recommendation: Add `assert.match(res.headers['content-type'], /json/)`.

## SHOULD FIX

### 3. JSON parse error test does not verify response body is JSON
File: `packages/api/tests/app.test.js`.
Malformed JSON test asserts 400 but doesn't verify body is RFC 7807 JSON. Express body-parser may return HTML.

### 4. CORS rejection test is weak
File: `packages/api/tests/app.test.js`.
`notStrictEqual(header, 'http://evil.com')` passes even if CORS is absent.

### 5. Missing MPCG_PROJECT_DIR environment variable handling
File: `packages/api/app.js`.
Plan specifies MPCG_PROJECT_DIR defaults, but it's not implemented.

## NOTE

### 6. No routes/.gitkeep for empty directory
### 7. Fixture node types use 'Belief' — correct per schema but semantically unusual
