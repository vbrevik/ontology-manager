I now have all the context needed. Let me produce the section content.

# Section 04: Scenario Loader

## Overview

This section implements `lib/scenarios.js` (the scenario loading and graph construction module) and `routes/scenarios.js` (the Express route handlers for scenario endpoints). The scenario loader reads scenario JSON files from disk, constructs valid MPCG graphs from `expected_entities`/`expected_relationships` definitions, and caches results. Three routes expose this data: list all scenarios, get group hierarchy, and get a single scenario with its constructed graph.

**Files to create:**
- `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/lib/scenarios.js`
- `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/routes/scenarios.js`
- `/Users/vidarbrevik/projects/multi-perspective-context-ontology/packages/api/tests/scenarios.test.js`

**Dependencies (must be completed first):**
- Section 01 (package-setup): `createApp()` factory, test infrastructure, `supertest` available
- Section 02 (error-handling): `ApiError` class for 404 responses, RFC 7807 error handler

---

## Tests

All tests use `node:test` + `node:assert/strict` + `supertest`, following the project convention. Tests import `createApp()` and pass it to `supertest`.

**File:** `packages/api/tests/scenarios.test.js`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { validate } from '@mpcg/core';

/**
 * Scenario route tests.
 * 
 * createApp() loads scenarios from MPCG_PROJECT_DIR/src/scenarios/ at startup.
 * The test relies on the real scenario files existing on disk. If the project
 * has been set up correctly (section-01), MPCG_PROJECT_DIR resolves to the
 * project root and scenarios are available.
 */

describe('GET /api/scenarios', () => {
  // Test: returns array with id, group, subgroup fields
  // Test: returns entityCount and relationshipCount per scenario
});

describe('GET /api/scenarios/groups', () => {
  // Test: returns group/subgroup hierarchy
  // Test: is registered before /:id (no route conflict)
});

describe('GET /api/scenarios/:id', () => {
  // Test: with valid ID returns scenario data
  // Test: includes constructed MPCG graph
  // Test: constructed graph has nodes with UUIDs as IDs
  // Test: constructed graph has edges referencing valid node IDs
  // Test: constructed graph passes validate()
  // Test: with unknown ID returns 404
  // Test: scenario with duplicate labels uses first-match for edge resolution
});
```

### Key test behaviors

**List endpoint** (`GET /api/scenarios`): Response is an array. Each entry has at minimum `id` (string), `group` (string), `subgroup` (string), `entityCount` (number), `relationshipCount` (number). The response should NOT include the full constructed graph (too heavy for a list).

**Groups endpoint** (`GET /api/scenarios/groups`): Returns the parsed content of `_groups.json`. Must be reachable (not shadowed by the `/:id` route). Test this by asserting the response has a `groups` array with objects containing `id`, `label`, and `subgroups` keys.

**Detail endpoint** (`GET /api/scenarios/:id`): Returns the scenario metadata plus a `graph` property containing the constructed MPCG graph. The graph must have:
- A top-level `id` (UUID)
- A `nodes` array where every node has a UUID `id`, a valid `type`, and a `label`
- An `edges` array where every edge's `source` and `target` match a node `id` in the graph
- The graph passes `validate()` from `@mpcg/core` (call validate on the constructed graph and assert `valid: true`)

**404 for unknown ID**: Request a non-existent scenario ID, expect 404 with RFC 7807 format.

**Duplicate label handling**: Construct a scenario (or use a test fixture) where two entities share the same label. The edge resolver should use the first match. This can be tested by mocking the scenario data or by testing `lib/scenarios.js` directly.

---

## Implementation: lib/scenarios.js

**File:** `packages/api/lib/scenarios.js`

This module exports a function that loads scenario files and provides access to them. It has two responsibilities: (1) reading scenario JSON files from disk and (2) constructing MPCG graphs from scenario definitions.

### Exported API

```javascript
/**
 * Load all scenarios from the given directory.
 * Reads _groups.json and all *.json scenario files recursively.
 * Returns an object with methods to access scenario data.
 *
 * @param {string} scenarioDir - Absolute path to scenarios directory
 * @returns {{ list(), groups(), get(id) }}
 */
export function loadScenarios(scenarioDir)
```

The returned object provides:
- `list()` -- returns array of scenario summaries (id, group, subgroup, entityCount, relationshipCount, description). No graph data.
- `groups()` -- returns the parsed `_groups.json` content.
- `get(id)` -- returns the full scenario data including the lazily constructed MPCG graph, or `null` if not found.

### File loading logic

1. Read `_groups.json` from the scenario directory root and parse it.
2. Recursively walk subdirectories of `scenarioDir`.
3. For each `.json` file that is NOT `_groups.json`, parse it as a scenario.
4. Each scenario file has this structure (observed from the actual files on disk):
   ```json
   {
     "id": "military-cop-update",
     "group": "operational",
     "subgroup": "military",
     "description": "...",
     "expected_entities": [
       { "label": "Colonel Whitfield", "expected_type": "Person" }
     ],
     "expected_relationships": [
       { "source": "Colonel Whitfield", "target": "COP Update", "expected_type": "produces" }
     ]
   }
   ```
5. Store all parsed scenarios in a `Map` keyed by their `id` field.
6. Use `fs.readdirSync` with `{ recursive: true }` (Node 20+) or manual recursion using `fs.readdirSync` + `fs.statSync`.

### Graph construction logic

Graph construction is lazy -- it happens on first `get(id)` call for each scenario, then the result is cached.

Algorithm for `buildGraph(scenario)`:

1. Generate a graph UUID using `crypto.randomUUID()`.
2. Create a `labelToNode` map for resolving edges.
3. For each entry in `expected_entities`:
   - Create a node: `{ id: crypto.randomUUID(), type: entry.expected_type, label: entry.label }`
   - Store in `labelToNode` map. If the label already exists, log a warning and keep the first entry (do not overwrite).
4. For each entry in `expected_relationships`:
   - Look up `source` label in `labelToNode` to get the source node ID.
   - Look up `target` label in `labelToNode` to get the target node ID.
   - If either lookup fails, log a warning and skip this edge.
   - Create an edge: `{ id: crypto.randomUUID(), type: entry.expected_type, source: sourceNode.id, target: targetNode.id }`
5. Assemble the graph object:
   ```javascript
   {
     id: graphUUID,
     nodes: [...nodes],
     edges: [...edges]
   }
   ```
6. Cache the constructed graph alongside the scenario data.

### Caching strategy

- Scenario metadata (from JSON files) is loaded once at startup and never reloaded.
- Constructed graphs are built lazily on first access per scenario and stored in a separate cache map.
- There is no cache invalidation -- scenarios do not change at runtime.

---

## Implementation: routes/scenarios.js

**File:** `packages/api/routes/scenarios.js`

This module exports a function that creates and returns an Express Router with three routes.

```javascript
import { Router } from 'express';
import { ApiError } from '../lib/errors.js';

/**
 * Create scenario routes.
 * @param {object} scenarios - The object returned by loadScenarios()
 * @returns {Router}
 */
export function scenarioRoutes(scenarios)
```

### Route: GET /api/scenarios

Calls `scenarios.list()` and returns the array as JSON. Status 200.

### Route: GET /api/scenarios/groups

Calls `scenarios.groups()` and returns the result as JSON. Status 200.

**Critical:** This route MUST be registered before the `/:id` route in the router. Express matches routes in registration order, and `"groups"` would otherwise be captured as an `:id` parameter.

### Route: GET /api/scenarios/:id

Calls `scenarios.get(req.params.id)`. If the result is `null`, throw `new ApiError(404, 'Scenario not found')`. Otherwise return the full scenario data (including the constructed graph) as JSON. Status 200.

---

## Integration with createApp

In `app.js`, the scenario loader is initialized during app creation:

1. `createApp(options)` receives `scenarioDir` (defaulting to `path.join(MPCG_PROJECT_DIR, 'src', 'scenarios')`).
2. Call `loadScenarios(scenarioDir)` to load all scenario files.
3. Mount `scenarioRoutes(scenarios)` at `/api/scenarios`.

This means scenario files are read synchronously at startup. The directory path comes from the `MPCG_PROJECT_DIR` environment variable or defaults to the project root relative to `packages/api/`.

---

## Scenario file structure on disk

The scenario directory has this layout (for reference when implementing the recursive loader):

```
src/scenarios/
├── _groups.json                          ← Group/subgroup metadata
├── operational/
│   ├── military-cop-update.json
│   ├── military-disaster-response.json
│   ├── commerce-supply-chain-disruption.json
│   └── ...
├── human-systems/
│   ├── governance-board-meeting.json
│   └── ...
├── intelligence/
│   ├── military-sigint-operation.json
│   └── ...
└── ... (16 subdirectories total)
```

Each subdirectory name matches a group `id` from `_groups.json`. Scenario filenames often follow the pattern `{subgroup}-{topic}.json` but the loader should not rely on naming conventions -- use the `id`, `group`, and `subgroup` fields from within each JSON file.

---

## Error cases

| Scenario | Response |
|----------|----------|
| `GET /api/scenarios/:id` with unknown ID | 404 RFC 7807: `"Scenario not found"` |
| Scenario file has invalid JSON | Skip file, log warning at startup (do not crash) |
| Edge references non-existent label | Skip edge, log warning (graph may have fewer edges than `expected_relationships`) |
| Duplicate entity labels | Use first match, log warning |

---

## Design notes

- The scenario loader is a pure data module with no Express dependency. It receives a directory path and returns a plain object. This makes it testable independently of HTTP.
- `crypto.randomUUID()` is available in Node 20+ without any imports (it is a global). However, importing from `node:crypto` is also fine.
- The constructed graphs should be valid MPCG graphs that pass `validate()`. If a scenario produces a graph that fails validation, this indicates a problem with the scenario file, not the loader. The loader should still return the graph (it is best-effort construction) but tests should verify that real scenario files produce valid graphs.