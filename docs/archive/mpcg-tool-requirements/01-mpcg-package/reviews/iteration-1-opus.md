# Opus Review

**Model:** claude-opus-4
**Generated:** 2026-03-20T21:45:00Z

---

## Review of Implementation Plan: @mpcg/core Package

### 1. Critical: CLI Side Effects on Module Import

The biggest problem in this plan is that `validate.js` has CLI code that runs unconditionally at the module top level (lines 179-212 of `/Users/vidarbrevik/projects/universal-context-model/src/validate.js`). When someone does `import { validate } from '@mpcg/core'`, `process.argv` will be inspected and the CLI block will execute. If no args are passed it calls `process.exit(0)`, which will **terminate the consuming application**.

The plan mentions in Section 4 under "What NOT to Annotate" that the CLI execution block should be left alone, but it does not address the fact that this code must be either removed or guarded in the packaged version. The `packages/core/validate.js` copy needs to strip or guard the CLI block, e.g., wrapping it in:

```javascript
if (import.meta.url === `file://${process.argv[1]}`) { ... }
```

Or removing it entirely since the package is a library, not a CLI. This is a show-stopper if missed.

### 2. Source Drift Between src/ and packages/core/

Section 6 recommends Option A: maintaining a separate `validate.js` in `packages/core/` while copying `graph-engine.js`, `schema.json`, and `taxonomy.json` from `src/`. This creates two divergence vectors:

- `validate.js` is manually maintained in two places. Any bug fix to validation logic in `src/validate.js` must be manually ported to `packages/core/validate.js`.
- `graph-engine.js` is copied, so its source of truth is clear, but there is no mechanism to detect when `src/graph-engine.js` changes and the package copy becomes stale.

The plan should add a CI check or pre-test script that compares `src/graph-engine.js` against `packages/core/graph-engine.js` (and the JSON files) to catch drift. For `validate.js`, the plan should explicitly document which parts differ and consider extracting the shared logic into a common function that both the CLI wrapper and the package import.

### 3. AJV Re-creation with Custom Schema -- Performance and Correctness

Section 3 states: "The AJV instance must be re-created when a custom schema is provided (since it compiles the schema)." But the plan does not address:

- **Performance**: AJV schema compilation is expensive. If `validate()` is called repeatedly with the same custom schema, re-compiling every time is wasteful. The plan should specify a caching strategy keyed on schema identity (reference equality check is cheapest).
- **Taxonomy re-processing**: When `options.taxonomy` is provided, the `buildAncestry()` maps and the `validNodeTypes`/`validEdgeTypes` sets also need to be recomputed. The plan mentions overriding the cached filesystem version but does not mention rebuilding these derived data structures. Missing this means custom taxonomy values would be silently ignored for domain/range checks.

### 4. Module-Level State Makes Custom Schema/Taxonomy Fragile

Looking at the source, `nodeAncestry`, `edgeAncestry`, `validNodeTypes`, and `validEdgeTypes` are module-level constants derived from the default schema and taxonomy (lines 39-42 of validate.js). The plan says to parameterize `validate()` but does not address these four derived constants. If someone passes `options.taxonomy`, the domain/range checks in phase 5 would still use the original module-level ancestry maps, not the custom taxonomy.

The parameterization needs to be deeper than just swapping the AJV schema. The plan should specify that all derived state (ancestry maps, valid type sets) must be recomputed from the provided schema/taxonomy when custom values are given.

### 5. Missing .gitignore Updates

The plan copies files into `packages/core/` and generates `.d.ts` files into `packages/core/types/`. Neither the generated types nor the copied source files should be committed to git (they are build artifacts). The `.gitignore` at `/Users/vidarbrevik/projects/universal-context-model/.gitignore` currently only has `node_modules/`, `output/`, and `.env`. The plan should add:

```
packages/core/types/
packages/core/schema.json
packages/core/taxonomy.json
packages/core/graph-engine.js
```

Without this, the copied files will show up in git status and risk being committed alongside the originals, creating confusion about which is canonical.

### 6. The `export` Statement Position in validate.js

The current `validate.js` has `export { validate }` at line 214, after the CLI block. This means the export is at the bottom of the file, after `process.exit()` calls. In the packaged version, this export placement interacts with the CLI side-effect issue from point 1. Even if the CLI block does not exit, the export is fine for ESM (hoisted). But this further reinforces that the CLI block must be addressed.

### 7. TypeScript Test Configuration Gap

Section 7 specifies `packages/core/tests/types.test.ts` with `tsc --noEmit tests/types.test.ts`. This bare `tsc` invocation will not know about the package's exports map or the `@mpcg/core` alias. The test would need either:

- A separate `tsconfig.test.json` with `paths` mapping `@mpcg/core` to the package's types
- Or importing from relative paths (which defeats the purpose of testing the package interface)

The plan should specify the tsconfig configuration needed for the type test to resolve `@mpcg/core` correctly.

### 8. Missing `pnpm install` Step for Dependency Resolution

The plan says `packages/core/package.json` will have `ajv` and `ajv-formats` as dependencies. But the root `package.json` also has these as dependencies. With pnpm workspaces, each package resolves its own dependencies independently. The plan does not mention running `pnpm install` after creating the workspace structure to ensure the workspace linking is set up. This is implicit but should be an explicit step in Section 8.

Additionally, the root `package.json` has `@anthropic-ai/sdk` and `neo4j-driver` which are not needed by `@mpcg/core`. The plan correctly scopes the package dependencies, but does not mention whether the root dependencies should be moved to devDependencies or a future package. This is a minor point but worth noting for cleanliness.

### 9. `moduleResolution: "node"` in tsconfig.json

Section 5 specifies `"moduleResolution": "node"`. For ESM packages using the `"exports"` field in package.json, `"moduleResolution": "node16"` or `"bundler"` would be more appropriate. The classic `"node"` resolution does not understand package.json `"exports"` maps, which could cause type resolution issues when consuming packages try to import from `@mpcg/core`.

### 10. `visibleAt` Parameter `releasableTo` Is Unused

In `graph-engine.js` line 124, `visibleAt(classification, releasableTo)` accepts a `releasableTo` parameter that is never used in the method body. When adding JSDoc annotations (Section 4), this should be either documented as "reserved for future use" or removed to avoid confusing consumers of the type definitions. If it stays, the generated `.d.ts` will show a parameter that does nothing.

### 11. No Clean Script

The plan has a `build` script but no `clean` script. Since the build copies files and generates types, there should be a way to remove all generated artifacts. This is especially important given that the copied files should not be committed (point 5). A `clean` script or `prebuild` that removes stale artifacts before copying would prevent issues with leftover files from previous builds.

### 12. Missing `index.js` Schema/Taxonomy Loading Detail

Section 2 says `index.js` will export `schema`, `taxonomy`, `nodeTypes`, and `edgeTypes`, noting that these are "parsed JSON objects" and extracted enum arrays. But it does not specify how `index.js` loads the JSON files. Will it use `import` assertions (`import schema from './schema.json' with { type: 'json' }`)? Or `readFileSync` + `JSON.parse`? Import assertions require Node 20.10+ and are still somewhat experimental. `createRequire` is another option. The plan should be explicit about the JSON loading mechanism since this is a common ESM pain point.

### 13. Stats Return Type Inconsistency

The plan defines `GraphStats` as `{ nodes, edges, nodeTypes, edgeTypes, perspective, security }` in Section 4. Looking at the actual `stats()` method, `nodeTypes` and `edgeTypes` are arrays of strings (keys from Maps), not counts. But in the `ValidationResult.stats`, `nodeTypes` and `edgeTypes` are numbers (Set sizes). The JSDoc type definitions should distinguish between these two different shapes rather than using the same type name. This is not a bug in the plan per se, but the type naming will cause confusion if not carefully handled.

### Summary of Priority Items

1. **Blocking**: CLI side-effect / `process.exit()` in packaged `validate.js` (point 1)
2. **Blocking**: Custom taxonomy not actually affecting derived state in `validate()` (points 3, 4)
3. **High**: `.gitignore` for build artifacts (point 5)
4. **High**: `moduleResolution` should be `node16` not `node` (point 9)
5. **High**: TypeScript test needs proper tsconfig for `@mpcg/core` resolution (point 7)
6. **Medium**: Source drift detection between `src/` and `packages/core/` (point 2)
7. **Medium**: JSON loading mechanism in `index.js` unspecified (point 12)
8. **Low**: Missing clean script, unused parameter, stats type naming (points 10, 11, 13)
