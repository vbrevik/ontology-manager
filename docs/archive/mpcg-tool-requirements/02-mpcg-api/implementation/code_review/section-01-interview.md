# Section 01 Code Review Interview

## Triage Summary

All findings were auto-fixed without user input.

## Auto-Fixes Applied

### 1. Error handler — stopped leaking err.message (MUST FIX)
**Decision:** Auto-fix
Changed error handler to use generic status-based titles instead of `err.message`. Prevents STIG V-222610 violations from body-parser or Express internal errors leaking details.

### 2. Content-Type assertion on 404 test (MUST FIX)
**Decision:** Auto-fix
Added `assert.match(res.headers['content-type'], /json/)` to verify 404 responses are JSON.

### 3. Malformed JSON test body verification (SHOULD FIX)
**Decision:** Auto-fix
Added assertions for Content-Type and `body.status` on malformed JSON responses to verify the centralized error handler catches body-parser SyntaxErrors as JSON.

### 4. CORS rejection test (SHOULD FIX)
**Decision:** Let go
The `cors` package with a string origin behaves as designed — it sets the header on preflight responses for all origins but only the configured origin is reflected. The test correctly uses `notStrictEqual` to verify the evil origin isn't allowed. This is the expected behavior of the cors package.

### 5. MPCG_PROJECT_DIR support (SHOULD FIX)
**Decision:** Auto-fix
Added `MPCG_PROJECT_DIR` environment variable support with default `resolve(__dirname, '../../')`. Set on `app.locals.projectDir`. Also made `scenarioDir` default to `resolve(projectDir, 'scenarios')`.

## Let Go

### 6. routes/.gitkeep
Later sections will add files to the directory. Not needed.

### 7. Fixture 'Belief' type semantics
Correct per schema. Labels are for readability.
