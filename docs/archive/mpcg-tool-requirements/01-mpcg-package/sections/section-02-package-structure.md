Now I have all the context I need. Let me generate the section content.

# Section 2: Package Structure and Entry Point

## Overview

This section creates the `packages/core/index.js` entry point file -- the main module that consumers import when they use `@mpcg/core`. It re-exports the public API surface: the `validate` function, `MPCGGraph` class, parsed `schema` and `taxonomy` objects, and extracted `nodeTypes` and `edgeTypes` arrays.

**Depends on:** Section 01 (workspace foundation -- `packages/core/package.json` must exist)
**Blocks:** Sections 03, 04, 05, 06

## Tests First

These tests go in `packages/core/tests/index-exports.test.js` and use Node's built-in `node:test` framework, matching the existing project convention. They validate that `index.js` exports the correct symbols with the correct types.

**Important:** These tests import from the local file (`../index.js`), not from `@mpcg/core`, because the build pipeline (Section 06) has not run yet at this stage. The package-name import tests come later in Section 07.

**Pre-condition:** Before these tests can run, `schema.json` and `taxonomy.json` must be present in `packages/core/`. During development of this section, manually copy them from `src/`. The build script (Section 06) will automate this later.

```
File: /Users/vidarbrevik/projects/universal-context-model/packages/core/tests/index-exports.test.js

# Test: index.js exports validate as a function
# Test: index.js exports MPCGGraph as a class (constructor)
# Test: index.js exports schema as an object with $defs property
# Test: index.js exports taxonomy as an object with nodeTypes and edgeTypes
# Test: index.js exports nodeTypes as a non-empty string array
# Test: index.js exports edgeTypes as a non-empty string array
# Test: nodeTypes array contains known types like "Person", "Event", "Concept"
# Test: edgeTypes array contains known types like "causes", "contains", "believes"
# Test: schema and taxonomy loaded via readFileSync resolve from package directory
```

The test file structure should follow the existing pattern from the project (using `describe`/`it` from `node:test` and `assert` from `node:assert`):

```javascript
// packages/core/tests/index-exports.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes } from '../index.js';

describe('@mpcg/core index.js exports', () => {
  it('exports validate as a function', () => { /* assert typeof validate === 'function' */ });
  it('exports MPCGGraph as a class with constructor', () => { /* assert typeof MPCGGraph === 'function' */ });
  it('exports schema as an object with $defs property', () => { /* assert schema.$defs exists */ });
  it('exports taxonomy with nodeTypes and edgeTypes', () => { /* assert taxonomy.nodeTypes and taxonomy.edgeTypes exist */ });
  it('exports nodeTypes as a non-empty string array', () => { /* assert Array.isArray, length > 0, typeof [0] === 'string' */ });
  it('exports edgeTypes as a non-empty string array', () => { /* assert Array.isArray, length > 0, typeof [0] === 'string' */ });
  it('nodeTypes contains known types', () => { /* assert includes "Person", "Event", "Concept" */ });
  it('edgeTypes contains known types', () => { /* assert includes "causes", "contains", "believes" */ });
  it('schema and taxonomy resolve from package directory', () => {
    /* assert schema.$defs.NodeType and schema.$defs.EdgeType exist */
    /* This implicitly tests that readFileSync + __dirname resolved correctly */
  });
});
```

## Implementation

### File to Create

**`/Users/vidarbrevik/projects/universal-context-model/packages/core/index.js`**

### JSON Loading Pattern

The file loads `schema.json` and `taxonomy.json` using `readFileSync` + `JSON.parse`, following the exact same pattern already used in `src/validate.js`. This avoids experimental ESM JSON import assertions.

The `__dirname` equivalent in ESM is computed via:

```javascript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
```

This is the same pattern used at lines 13-17 of the existing `src/validate.js`.

### Exports

The `index.js` file exports six symbols:

| Export | Type | Source |
|--------|------|--------|
| `validate` | function | Re-exported from `./validate.js` |
| `MPCGGraph` | class | Re-exported from `./graph-engine.js` |
| `schema` | object | Parsed from `./schema.json` via `readFileSync` |
| `taxonomy` | object | Parsed from `./taxonomy.json` via `readFileSync` |
| `nodeTypes` | string[] | Extracted from `schema.$defs.NodeType.enum` |
| `edgeTypes` | string[] | Extracted from `schema.$defs.EdgeType.enum` |

### Extracting nodeTypes and edgeTypes

The `nodeTypes` and `edgeTypes` arrays come from the JSON Schema's `$defs` section. In `schema.json`, these are defined as enums:

- `schema.$defs.NodeType.enum` -- array of all valid node type strings (e.g., `"Person"`, `"Event"`, `"Concept"`)
- `schema.$defs.EdgeType.enum` -- array of all valid edge type strings (e.g., `"causes"`, `"contains"`, `"believes"`)

These are extracted after loading the schema and exported as constants.

### index.js Structure

The file should contain (in order):

1. Filesystem imports (`fs`, `path`, `url`)
2. `__dirname` computation
3. Load and parse `schema.json` and `taxonomy.json`
4. Extract `nodeTypes` from `schema.$defs.NodeType.enum`
5. Extract `edgeTypes` from `schema.$defs.EdgeType.enum`
6. Re-export `validate` from `./validate.js`
7. Re-export `MPCGGraph` from `./graph-engine.js`
8. Export `schema`, `taxonomy`, `nodeTypes`, `edgeTypes`

### Co-located File Dependencies

At the time `index.js` runs, the following files must be present in the same directory (`packages/core/`):

- `schema.json` -- loaded by `index.js` via `readFileSync`
- `taxonomy.json` -- loaded by `index.js` via `readFileSync`
- `validate.js` -- imported by `index.js` (re-export) and also by `graph-engine.js`
- `graph-engine.js` -- imported by `index.js` (re-export)

During development of this section, copy these files manually from `src/`:
- `cp src/schema.json packages/core/schema.json`
- `cp src/taxonomy.json packages/core/taxonomy.json`
- `cp src/graph-engine.js packages/core/graph-engine.js`

For `validate.js`, initially copy it from `src/validate.js` as well. Section 03 will modify this copy with parameterization and CLI guard changes.

### Package.json Exports Field

The `packages/core/package.json` (created in Section 01) must have the `exports` field pointing to `index.js`. This is critical for the `@mpcg/core` import to resolve:

```json
{
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "default": "./index.js"
    }
  }
}
```

The `"types"` condition must come before `"default"` for TypeScript resolution to work. The `types/index.d.ts` file will not exist until Section 05, but the exports field should be configured now.

### Verification

After creating `index.js` and ensuring the co-located files are present:

1. Run `node --test packages/core/tests/index-exports.test.js` -- all 9 tests should pass
2. Verify with a quick smoke test: `node -e "import('@mpcg/core').then(m => console.log(Object.keys(m)))"` from the project root (requires `pnpm install` from Section 01 to have run)