Now I have all the context needed. Let me generate the section content.

# Section 3: validate.js Parameterization

## Overview

This section modifies `packages/core/validate.js` to accept an optional `{ schema, taxonomy }` parameter on the `validate()` function, and removes the CLI side-effect block so the file works safely as a library import. The original `src/validate.js` remains untouched.

**Depends on:** Section 02 (package structure and entry point must exist)
**Blocks:** Section 04 (JSDoc annotations), Section 07 (package tests)

---

## Background: Current validate.js Behavior

The source file at `src/validate.js` (214 lines) does three things at module initialization time:

1. Loads `schema.json` and `taxonomy.json` from disk using `readFileSync` relative to `__dirname`
2. Compiles an AJV 2020 instance with the loaded schema
3. Builds derived state: `nodeAncestry` map, `edgeAncestry` map, `validNodeTypes` set, `validEdgeTypes` set -- all from the loaded schema/taxonomy

At the bottom of the file (lines 179-212), a CLI block runs unconditionally: it inspects `process.argv`, prints usage if no args, and calls `process.exit()`. This means importing `validate.js` as a module in any application would terminate that application immediately.

The `validate(graph)` function currently accepts only one argument and uses the module-level cached schema/taxonomy/AJV/ancestry state for all validation.

---

## Tests First

Create or verify the following test expectations. These tests validate the parameterized `validate.js` in `packages/core/`. They should be placed in `packages/core/tests/` and run with `node --test`.

**File:** `packages/core/tests/validate-parameterization.test.js`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('validate.js parameterization', () => {

  it('validate(validGraph) returns { valid: true } with default schema/taxonomy', async () => {
    // Import validate from packages/core/validate.js
    // Create a minimal valid graph (nodes + edges with valid types)
    // Call validate(graph) with no options
    // Assert result.valid === true
  });

  it('validate(invalidGraph) returns { valid: false } with errors', async () => {
    // Create a graph with invalid node types or broken references
    // Call validate(graph)
    // Assert result.valid === false and result.errors.length > 0
  });

  it('validate(graph, { schema }) uses provided schema instead of default', async () => {
    // Load a modified schema (e.g., with a restricted NodeType enum)
    // Call validate(graph, { schema: modifiedSchema })
    // Assert that validation uses the custom schema (node type valid under custom but not default, or vice versa)
  });

  it('validate(graph, { taxonomy }) uses provided taxonomy for domain/range checks', async () => {
    // Create a custom taxonomy with different nodeTypes hierarchy
    // Call validate(graph, { taxonomy: customTaxonomy })
    // Assert domain/range warnings reflect the custom taxonomy, not the default
  });

  it('validate(graph, { schema, taxonomy }) uses both custom values', async () => {
    // Provide both custom schema and custom taxonomy
    // Assert validation uses both
  });

  it('validate with custom taxonomy rebuilds ancestry maps (not using defaults)', async () => {
    // Provide a taxonomy where a type has different ancestors than in the default
    // Verify domain/range checks use the rebuilt ancestry, not the cached default
  });

  it('validate with custom taxonomy correctly applies domain/range constraints from custom taxonomy', async () => {
    // Create edge with agent-requiring type, source is agent in custom taxonomy but not default
    // Verify no warning is produced (custom taxonomy is used)
  });

  it('validate with same custom schema called twice reuses cached AJV instance', async () => {
    // Call validate(graph, { schema: customSchema }) twice with the same object reference
    // Performance: second call should not recompile AJV (implementation detail, hard to test directly)
    // Can verify by timing or by checking result consistency
  });

  it('validate with different custom schemas creates separate AJV instances', async () => {
    // Call with schemaA then schemaB (different object references)
    // Verify each validates according to its own schema
  });

  it('CLI block does not execute when validate.js is imported as a module', async () => {
    // Import validate.js as a module
    // If we get here without process.exit being called, the test passes
    // The import itself is the test
  });

  it('No process.exit() called when importing validate.js', async () => {
    // Same as above - importing the module should not call process.exit
    // Verified by the fact that the test process continues running
  });

  it('existing tests in src/tests/ still pass against src/validate.js (regression)', async () => {
    // This is verified by running pnpm test from root
    // Not a unit test here -- just a note that src/validate.js must remain unchanged
  });
});
```

---

## Implementation Details

### File to Create/Modify

**File:** `packages/core/validate.js`

This is a modified version of `src/validate.js`. It is NOT a copy -- it is maintained separately in `packages/core/` (the build script from Section 06 does NOT overwrite it). The original `src/validate.js` remains unchanged.

### Change 1: Remove the CLI Block

Delete the entire CLI execution block (lines 179-212 in the original). The packaged `validate.js` is a library, not a CLI tool. The CLI functionality remains in `src/validate.js` for direct use.

The removed block starts at `const args = process.argv.slice(2);` and runs through the end of the file (before `export { validate }`).

### Change 2: Add Optional Options Parameter

Change the function signature from:

```javascript
function validate(graph)
```

to:

```javascript
function validate(graph, options = {})
```

Where `options` may contain:
- `schema` -- a parsed JSON Schema object (same shape as `schema.json`)
- `taxonomy` -- a parsed taxonomy object (same shape as `taxonomy.json`)

### Change 3: Lazy Default Initialization with Caching

Replace the current module-level eager initialization pattern. Currently the file does this at the top level:

```javascript
const schema = JSON.parse(readFileSync(join(__dirname, "schema.json"), "utf8"));
const taxonomy = JSON.parse(readFileSync(join(__dirname, "taxonomy.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const nodeAncestry = buildAncestry(taxonomy.nodeTypes);
const edgeAncestry = buildAncestry(taxonomy.edgeTypes);
const validNodeTypes = new Set(schema.$defs.NodeType.enum);
const validEdgeTypes = new Set(schema.$defs.EdgeType.enum);
```

Replace with a lazy initialization pattern:

1. Keep the `__dirname`, `readFileSync`, and `buildAncestry` function as-is at module level
2. Create a `let defaultState = null;` at module level
3. Create a `getDefaultState()` function that loads from disk on first call and caches
4. Create a `buildState(schema, taxonomy)` function that compiles AJV + builds ancestry maps + type sets from given schema/taxonomy

### Change 4: Derive All State from Options When Provided

Inside `validate(graph, options = {})`:

1. Determine the effective schema: `options.schema ?? getDefaultState().schema`
2. Determine the effective taxonomy: `options.taxonomy ?? getDefaultState().taxonomy`
3. If either differs from the defaults, call `buildState(effectiveSchema, effectiveTaxonomy)` to get a fresh set of: AJV compiled validator, nodeAncestry, edgeAncestry, validNodeTypes, validEdgeTypes
4. If both are defaults, use the cached default state

**Critical detail:** The `nodeAncestry`, `edgeAncestry`, `validNodeTypes`, and `validEdgeTypes` are all derived from schema/taxonomy. When `options.taxonomy` is provided, the ancestry maps MUST be rebuilt from the custom taxonomy. When `options.schema` is provided, the type sets (`validNodeTypes`, `validEdgeTypes`) MUST be rebuilt from the custom schema's `$defs.NodeType.enum` and `$defs.EdgeType.enum`. Failing to do this would cause domain/range checks (phase 5) and type validity checks (phase 3) to silently use default values.

### Change 5: Cache by Object Reference for Performance

Maintain a cache (e.g., a `WeakMap` or a simple last-used cache) keyed on the schema/taxonomy object references:

```javascript
// Cache approach: store last-used custom state
let cachedCustomState = null;
let cachedCustomSchema = null;
let cachedCustomTaxonomy = null;
```

When `validate` is called with custom options:
- If `options.schema === cachedCustomSchema && options.taxonomy === cachedCustomTaxonomy`, reuse `cachedCustomState`
- Otherwise, build new state and cache it

This avoids recompiling AJV on every call when the same custom schema is passed repeatedly.

### Change 6: Update Internal References

Inside the `validate` function body, all references to the module-level `validateSchema`, `nodeAncestry`, `edgeAncestry`, `validNodeTypes`, `validEdgeTypes` must be replaced with references to the resolved state object. For example:

```javascript
function validate(graph, options = {}) {
  const state = resolveState(options);
  // Use state.validateSchema, state.nodeAncestry, state.edgeAncestry,
  // state.validNodeTypes, state.validEdgeTypes throughout
  ...
}
```

The `resolveState(options)` helper returns either the default state or builds/retrieves cached custom state.

### Structural Outline of Modified validate.js

```javascript
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- buildAncestry function (unchanged) ---

// --- State management ---
// let defaultState = null;
// function getDefaultState() { /* load from disk, compile, cache */ }
// function buildState(schema, taxonomy) { /* compile AJV, build ancestry, build type sets */ }
// function resolveState(options) { /* return default or custom state */ }

// --- Caching for custom state ---
// let cachedCustomSchema, cachedCustomTaxonomy, cachedCustomState;

function validate(graph, options = {}) {
  // const state = resolveState(options);
  // ... rest of validation logic using state.validateSchema, state.nodeAncestry, etc.
  // ... phases 1-8 remain identical in logic
  // ... return { valid, errors, warnings, stats }
}

// No CLI block -- this is a library module

export { validate };
```

### The buildAncestry Function

This function is unchanged from the original. It remains a module-level utility:

```javascript
function buildAncestry(tree, parentChain = []) {
  const map = new Map();
  for (const [name, def] of Object.entries(tree)) {
    map.set(name, [...parentChain]);
    if (def.subtypes) {
      const childMap = buildAncestry(def.subtypes, [...parentChain, name]);
      for (const [k, v] of childMap) map.set(k, v);
    }
  }
  return map;
}
```

### The isSubtype Helper

The `isSubtype` function inside `validate` currently closes over the module-level `nodeAncestry`. After refactoring, it must use `state.nodeAncestry` instead:

```javascript
function isSubtype(type, family, ancestry) {
  if (family.has(type)) return true;
  const ancestors = ancestry.get(type) || [];
  return ancestors.some(a => family.has(a));
}
```

Pass the appropriate ancestry map (from state) when calling `isSubtype`.

---

## Verification Criteria

1. Importing `packages/core/validate.js` does NOT trigger `process.exit()` or print CLI usage
2. `validate(graph)` with no options produces identical results to the original `src/validate.js`
3. `validate(graph, { schema: customSchema })` uses the custom schema for AJV compilation and type validity checks
4. `validate(graph, { taxonomy: customTaxonomy })` uses the custom taxonomy for ancestry maps and domain/range checks
5. Passing the same custom objects on repeated calls does not recompile AJV each time
6. All existing 22 tests in `src/tests/` continue to pass against the unchanged `src/validate.js`
7. The `export { validate }` statement remains at the end of the file