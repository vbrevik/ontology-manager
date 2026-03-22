# TDD Plan: @mpcg/core Package

Testing framework: Node.js built-in `node:test` (describe/it) + `node:assert`
Test runner: `node --test <glob>`
Conventions: Follow existing patterns from `src/tests/adversarial.test.js` and `src/tests/graph-engine.test.js`

---

## Section 1: pnpm Workspace Foundation

### Tests Before Implementation

```
# Test: pnpm-workspace.yaml exists at project root
# Test: pnpm-workspace.yaml contains 'packages/*' glob
# Test: root package.json has "private": true
# Test: root package.json retains existing dependencies (ajv, ajv-formats, etc.)
# Test: root package.json retains existing scripts (test, etc.)
# Test: packages/core/package.json exists with correct name "@mpcg/core"
# Test: packages/core/package.json has "type": "module"
# Test: packages/core/package.json has "engines": { "node": ">=20" }
# Test: packages/core/package.json has ajv and ajv-formats as dependencies
# Test: packages/core/package.json has "private": true
# Test: pnpm install succeeds from root without errors
# Test: @mpcg/core is symlinked in node_modules after pnpm install
```

Verification approach: Shell commands checking file existence and JSON field values. Not unit tests — these are workspace setup validation checks.

---

## Section 2: Package Structure and Entry Point

### Tests Before Implementation

```
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

---

## Section 3: validate.js Parameterization

### Tests Before Implementation

```
# Test: validate(validGraph) returns { valid: true } with default schema/taxonomy
# Test: validate(invalidGraph) returns { valid: false } with errors
# Test: validate(graph, { schema }) uses provided schema instead of default
# Test: validate(graph, { taxonomy }) uses provided taxonomy for domain/range checks
# Test: validate(graph, { schema, taxonomy }) uses both custom values
# Test: validate with custom taxonomy rebuilds ancestry maps (not using defaults)
# Test: validate with custom taxonomy correctly applies domain/range constraints from custom taxonomy
# Test: validate with same custom schema called twice reuses cached AJV instance (performance)
# Test: validate with different custom schemas creates separate AJV instances
# Test: CLI block does not execute when validate.js is imported as a module
# Test: No process.exit() called when importing validate.js
# Test: Existing 22 tests in src/tests/ still pass against src/validate.js (regression)
```

---

## Section 4: JSDoc Annotations

### Tests Before Implementation

```
# Test: tsc --noEmit runs against validate.js without type errors
# Test: tsc --noEmit runs against graph-engine.js without type errors
# Test: tsc --noEmit runs against index.js without type errors
# Test: All @typedef types are referenced by at least one @param or @returns
# Test: MPCGGraph class has JSDoc on constructor and all 11 public methods
# Test: validate function has JSDoc with correct parameter and return types
# Test: ValidationResult and ValidationStats are distinct types
# Test: GraphStats type has nodeTypes as string[] (not number)
```

Verification approach: `tsc` compilation checks. JSDoc coverage verified by attempting type generation and checking output.

---

## Section 5: TypeScript Generation Pipeline

### Tests Before Implementation

```
# Test: tsconfig.json exists in packages/core/
# Test: tsconfig.json has moduleResolution set to "node16"
# Test: tsc --project tsconfig.json generates types/index.d.ts
# Test: tsc --project tsconfig.json generates types/validate.d.ts
# Test: tsc --project tsconfig.json generates types/graph-engine.d.ts
# Test: Generated index.d.ts exports validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes
# Test: Generated types include MPCGNode, MPCGEdge, ValidationResult interfaces
# Test: package.json exports field has "types" before "default"
# Test: declarationMap files (.d.ts.map) are generated
```

---

## Section 6: Build and Copy Scripts

### Tests Before Implementation

```
# Test: scripts/build.js exists in packages/core/
# Test: Running build script copies schema.json from src/ to packages/core/
# Test: Running build script copies taxonomy.json from src/ to packages/core/
# Test: Running build script copies graph-engine.js from src/ to packages/core/
# Test: Build script does NOT overwrite validate.js (it's maintained separately)
# Test: Copied schema.json is byte-identical to src/schema.json
# Test: Copied taxonomy.json is byte-identical to src/taxonomy.json
# Test: Copied graph-engine.js is byte-identical to src/graph-engine.js
# Test: clean script removes types/, schema.json, taxonomy.json, graph-engine.js from packages/core/
# Test: .gitignore includes packages/core/types/ and copied files
# Test: Full build pipeline (clean → copy → tsc) completes without errors
```

---

## Section 7: Package Tests

### Tests Before Implementation

```
# Test: packages/core/tests/package-import.test.js exists
# Test: Package import test can import all 6 exports from '@mpcg/core'
# Test: Package import test validates schema structure ($defs, NodeType, EdgeType)
# Test: Package import test validates taxonomy structure (nodeTypes, edgeTypes)
# Test: Package import test calls validate() with a minimal valid graph
# Test: Package import test calls validate() with custom schema/taxonomy
# Test: Package import test constructs MPCGGraph and calls stats()
# Test: packages/core/tests/types.test.ts exists
# Test: tsconfig.test.json exists with paths mapping for @mpcg/core
# Test: tsc --noEmit --project tsconfig.test.json compiles types test
# Test: Types test imports and uses MPCGNode, MPCGEdge, ValidationResult types
```

---

## Section 8: Integration Verification

### Tests Before Implementation

```
# Test: pnpm install from root succeeds
# Test: pnpm test from root runs src/tests/*.test.js — all pass
# Test: pnpm --filter @mpcg/core build succeeds
# Test: pnpm --filter @mpcg/core test succeeds
# Test: pnpm --filter @mpcg/core test:types succeeds
# Test: No files in packages/core/ that should be gitignored appear in git status
# Test: AJV deep import (ajv/dist/2020.js) resolves within packages/core/node_modules
```
