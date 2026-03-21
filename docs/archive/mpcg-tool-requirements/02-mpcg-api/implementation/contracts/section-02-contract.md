# Section 02: Error Handling — Prompt Contract

## GOAL
Implement centralized RFC 7807 error handling: ApiError class, createProblem factory, errorHandler middleware, notFoundHandler, and update app.js to use them.

## CONTEXT
All route sections (03-07) depend on this error handling layer. Replaces the placeholder error handler from section-01.

## CONSTRAINTS
- RFC 7807 Problem Details format with Content-Type: application/problem+json
- STIG V-222610: 500 errors must not expose stack traces, file paths, or internal details
- STIG V-222585: Always return error response (fail-closed), never silently continue
- STIG V-222609: Malformed JSON handled as 400, server does not crash
- SyntaxError detection for express.json() parse failures
- Use node:http STATUS_CODES for title mapping

## FORMAT
Files to create/modify:
- CREATE `packages/api/lib/errors.js` — ApiError, createProblem, errorHandler, notFoundHandler
- CREATE `packages/api/tests/errors.test.js` — 8+ tests
- MODIFY `packages/api/app.js` — replace placeholder handlers with imports from lib/errors.js

## FAILURE CONDITIONS
- SHALL NOT expose err.message, err.stack, or file paths in 500 responses
- SHALL NOT use Content-Type: application/json (must be application/problem+json)
- SHALL NOT silently swallow errors (must always respond)
- SHALL NOT break existing section-01 tests
