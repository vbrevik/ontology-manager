I have all the context needed. Now I will generate the section content.

# Section 3: Taxonomy Routes

## Overview

This section implements the taxonomy and schema routes for the MPCG API. These routes expose the ontology type system (127 node types, 98 edge types) from `@mpcg/core` over HTTP, providing taxonomy tree browsing, schema access, flattened type listings, and type search.

**Files to create:**
- `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/routes/taxonomy.js`
- `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/tests/taxonomy.test.js`

**Dependencies (must be completed first):**
- Section 01 (Package Setup): `createApp()` factory, Express app structure, `supertest` dev dependency, test infrastructure
- Section 02 (Error Handling): `ApiError` class from `lib/errors.js`, centralized error handler, RFC 7807 format

## Tests

Tests go in `packages/api/tests/taxonomy.test.js`. They use `node:test` and `supertest`, importing the `createApp()` factory from `app.js`. No running server is needed; supertest manages its own ephemeral server.

### Test file structure

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createApp } from '../app.js';

const app = createApp();
```

### Test stubs

```javascript
describe('GET /api/taxonomy', () => {
  it('returns 200 with nodeTypes and edgeTypes keys', async () => {
    // GET /api/taxonomy -> 200
    // Assert response body has .nodeTypes and .edgeTypes properties
  });

  it('response matches @mpcg/core taxonomy export', async () => {
    // Import taxonomy from @mpcg/core
    // GET /api/taxonomy -> compare body to taxonomy object
  });
});

describe('GET /api/schema', () => {
  it('returns 200 with valid JSON Schema', async () => {
    // GET /api/schema -> 200
    // Assert response body has .$defs property
  });
});

describe('GET /api/types/nodes', () => {
  it('returns flat array of { name, description } objects', async () => {
    // GET /api/types/nodes -> 200
    // Assert body is array, each element has .name and .description strings
  });

  it('includes known types (e.g., "Person", "Organization")', async () => {
    // GET /api/types/nodes -> 200
    // Assert array contains entries with name "Person" and "Organization"
  });
});

describe('GET /api/types/edges', () => {
  it('returns flat array of { name, description } objects', async () => {
    // GET /api/types/edges -> 200
    // Assert body is array, each element has .name and .description strings
  });

  it('includes known types (e.g., "believes", "causes")', async () => {
    // GET /api/types/edges -> 200
    // Assert array contains entries with name "believes" and "causes"
  });
});

describe('GET /api/types/search', () => {
  it('returns matching node and edge types for a known term', async () => {
    // GET /api/types/search?q=belief -> 200
    // Assert response has .nodeTypes and .edgeTypes arrays
    // Assert at least one match found (e.g., "believes" in edgeTypes)
  });

  it('matches on description text, not just name', async () => {
    // Search for a word that appears in a description but not a type name
    // Assert results are returned
  });

  it('is case-insensitive', async () => {
    // GET /api/types/search?q=PERSON -> 200
    // Assert results include "Person" node type
  });

  it('without q parameter returns 400', async () => {
    // GET /api/types/search -> 400
    // Assert RFC 7807 format in response
  });

  it('with empty q parameter returns 400', async () => {
    // GET /api/types/search?q= -> 400
  });
});
```

## Implementation

### Route file: `packages/api/routes/taxonomy.js`

This module exports a function that creates and returns an Express `Router` instance. The router is mounted at `/api` by `createApp()` in `app.js`.

### Imports needed

The route module imports directly from `@mpcg/core`:
- `taxonomy` -- the hierarchical taxonomy tree (has `nodeTypes` and `edgeTypes` top-level keys, each containing a nested tree of `{ description, subtypes }` objects)
- `schema` -- the full JSON Schema object

It also imports `ApiError` from `../lib/errors.js` for input validation errors.

### Route definitions

**`GET /api/taxonomy`** -- Direct passthrough. Return `res.json(taxonomy)`. No transformation.

**`GET /api/schema`** -- Direct passthrough. Return `res.json(schema)`. No transformation.

**`GET /api/types/nodes`** -- Flatten the taxonomy's `nodeTypes` hierarchy into a flat array, then return it. Each entry is `{ name, description }`.

**`GET /api/types/edges`** -- Same flattening logic applied to the taxonomy's `edgeTypes` hierarchy.

**`GET /api/types/search?q=<term>`** -- Validate `q` is present and non-empty (throw `ApiError(400, ...)` otherwise). Search both flattened node and edge type lists. Return `{ nodeTypes: [...matches], edgeTypes: [...matches] }`.

### Taxonomy flattening algorithm

The taxonomy tree structure looks like this (from `packages/core/taxonomy.json`):

```json
{
  "nodeTypes": {
    "Entity": {
      "description": "Anything that exists...",
      "subtypes": {
        "Agent": {
          "description": "Anything capable of autonomous action...",
          "subtypes": {
            "Person": { "description": "Individual human being" },
            "Organization": { "description": "Group, institution..." }
          }
        }
      }
    }
  }
}
```

The flattening function walks this tree recursively. For each key at each level, it extracts `{ name: key, description: node.description }` and recurses into `node.subtypes` if present. The result is a flat array containing every type at every level of the hierarchy (parents and leaves alike).

A helper function signature:

```javascript
function flattenTypes(typeTree) {
  /** Walk the type hierarchy recursively, returning a flat array of { name, description }. */
}
```

This function is used by both `/api/types/nodes` and `/api/types/edges`, and can be computed once at module load time (the taxonomy is static).

### Search logic

The search endpoint filters the pre-computed flat arrays. For each type entry, check if the lowercase search term appears in the lowercase type name OR lowercase description. Return matches grouped into `{ nodeTypes: [...], edgeTypes: [...] }`.

```javascript
function searchTypes(flatList, term) {
  /** Filter flatList entries where term (case-insensitive) appears in name or description. */
}
```

### Route mounting

In `app.js`, the taxonomy router is mounted so that the routes are accessible at `/api/taxonomy`, `/api/schema`, and `/api/types/*`. The module exports a factory function:

```javascript
export default function createTaxonomyRouter() {
  const router = Router();
  // ... define routes ...
  return router;
}
```

The `createApp()` function mounts it:

```javascript
app.use('/api', createTaxonomyRouter());
```

This means the route handlers define paths as `/taxonomy`, `/schema`, `/types/nodes`, `/types/edges`, and `/types/search` within the router.

### Performance note

The flattened type arrays and the taxonomy/schema objects are all static data derived from `@mpcg/core` constants. They should be computed once at module import time, not on every request. The taxonomy has 127 node types and 98 edge types, so flattening is fast and the results are small.