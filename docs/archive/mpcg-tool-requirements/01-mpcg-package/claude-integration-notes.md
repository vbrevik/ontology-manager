# Integration Notes — Opus Review Feedback

## Integrating

### 1. CLI Side Effects (Blocking) — INTEGRATE
The CLI block in validate.js with `process.exit(0)` is a real show-stopper. The packaged validate.js must strip or guard this. Will add to Section 3 as a required modification.

### 3 & 4. Custom Schema/Taxonomy Derived State (Blocking) — INTEGRATE
Excellent catch. When custom taxonomy is provided, the ancestry maps and valid type sets must be recomputed. Will expand Section 3 to specify that all derived state (nodeAncestry, edgeAncestry, validNodeTypes, validEdgeTypes, AJV instance) must be rebuilt when custom options are provided.

### 5. .gitignore Updates (High) — INTEGRATE
Copied files and generated types are build artifacts and must be gitignored. Will add to Section 6.

### 7. TypeScript Test Configuration (High) — INTEGRATE
The bare `tsc --noEmit` won't resolve `@mpcg/core`. Need a `tsconfig.test.json` with paths mapping. Will add to Section 7.

### 9. moduleResolution (High) — INTEGRATE
`"node16"` is correct for ESM with exports field. Will fix in Section 5.

### 11. Clean Script (Low) — INTEGRATE
Simple addition. A `clean` script removes generated types and copied files. Will add to Section 6.

### 12. JSON Loading Mechanism (Medium) — INTEGRATE
Must specify how index.js loads schema.json. Will use `readFileSync` + `JSON.parse` (same pattern as validate.js) since import assertions are still evolving. Will add to Section 2.

### 13. Stats Type Naming (Low) — INTEGRATE
Will rename to `GraphStats` (arrays from graph-engine) vs `ValidationStats` (counts from validate) in Section 4.

## NOT Integrating

### 2. Source Drift Detection — NOT INTEGRATING
The plan already specifies that validate.js is maintained separately in packages/core/ (it has modifications). For graph-engine.js and JSON files, the build script copies them — that IS the drift prevention mechanism. A CI check adds complexity for a local-only workspace package. If drift matters later, it can be added.

### 6. Export Statement Position — NOT INTEGRATING
This is a consequence of point 1 (CLI side effects), which we're already addressing. ESM exports are hoisted so position doesn't matter functionally. No separate action needed.

### 8. pnpm install Step — NOT INTEGRATING
This is implicit in Section 8 verification ("pnpm install from root succeeds"). Making it more explicit would be over-specifying what's obvious.

### 10. Unused releasableTo Parameter — NOT INTEGRATING
This is an existing API concern, not a packaging concern. The JSDoc should document it accurately (parameter exists, reserved for future use). Removing it would be a breaking API change outside scope.
