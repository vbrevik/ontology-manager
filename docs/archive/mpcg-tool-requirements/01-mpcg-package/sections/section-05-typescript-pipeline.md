Now I have all the context needed. Let me generate the section content.

# Section 5: TypeScript Generation Pipeline

## Overview

This section creates the TypeScript declaration generation pipeline for `@mpcg/core`. The pipeline uses `tsc` with `allowJs` and `checkJs` to read JSDoc annotations from the `.js` source files and emit `.d.ts` declaration files into a `types/` directory. This gives TypeScript consumers full type information when importing from `@mpcg/core`.

**Depends on:** Section 4 (JSDoc Annotations) -- the `.d.ts` output quality depends entirely on the JSDoc annotations added in that section.

**Blocks:** Section 7 (Package Tests) -- the `types.test.ts` compilation test requires the generated `.d.ts` files.

## Tests (Write First)

All tests below validate the pipeline configuration and output. They can be run as shell-level verification checks after configuration is in place.

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

**Verification approach:** These are not unit tests run via `node --test`. They are verification commands to run after the pipeline is set up:

1. Check `packages/core/tsconfig.json` exists and has the correct fields (parse JSON, inspect keys).
2. Run `tsc --project packages/core/tsconfig.json` and confirm exit code 0.
3. Check that `packages/core/types/index.d.ts`, `packages/core/types/validate.d.ts`, and `packages/core/types/graph-engine.d.ts` all exist after the `tsc` run.
4. Read `packages/core/types/index.d.ts` and verify it contains exports for `validate`, `MPCGGraph`, `schema`, `taxonomy`, `nodeTypes`, `edgeTypes`.
5. Grep across generated `.d.ts` files for `MPCGNode`, `MPCGEdge`, `ValidationResult` type/interface declarations.
6. Parse `packages/core/package.json`, inspect `exports["."]` and confirm `"types"` key appears before `"default"` key.
7. Check that `.d.ts.map` files exist alongside each `.d.ts` file in `types/`.

## File: `packages/core/tsconfig.json`

Create this file with the following configuration:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationDir": "./types",
    "declarationMap": true,
    "strict": false,
    "module": "ES2020",
    "moduleResolution": "node16",
    "target": "ES2020"
  },
  "include": ["index.js", "validate.js", "graph-engine.js"]
}
```

### Key Configuration Decisions

- **`allowJs: true` + `checkJs: true`**: Tells `tsc` to process `.js` files and read their JSDoc annotations for type information.
- **`declaration: true` + `emitDeclarationOnly: true`**: Generates `.d.ts` files without emitting any JavaScript (the source `.js` files are the runtime code).
- **`declarationDir: "./types"`**: All generated `.d.ts` files go into `packages/core/types/`.
- **`declarationMap: true`**: Generates `.d.ts.map` files alongside declarations. This enables "Go to Definition" in editors to navigate from the `.d.ts` declaration back to the original `.js` source file, which is important for developer experience.
- **`strict: false`**: The existing JavaScript was not written with strict TypeScript in mind. Enabling strict mode would require significant refactoring that is outside the scope of this packaging effort.
- **`module: "ES2020"` + `moduleResolution: "node16"`**: Matches the ESM nature of the codebase (`"type": "module"` in package.json). `node16` resolution is the correct setting for modern Node.js ESM packages.
- **`target: "ES2020"`**: Matches the runtime target. The codebase uses modern JS features available in Node 20+.
- **`include`**: Only the three `.js` files that constitute the public API surface. JSON files do not need type generation. Test files are excluded (they have their own tsconfig in Section 7).

## File: `packages/core/package.json` -- Exports Field Update

The `package.json` created in Section 1 must have its `exports` field configured so TypeScript consumers resolve types correctly. The `"types"` condition **must** appear before `"default"` -- TypeScript's module resolution checks conditions in order and uses the first match.

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

If the `package.json` already has a partial `exports` field from Section 1, update it to include both conditions in the correct order. The full `package.json` should also have a top-level `"types"` field as a fallback for older TypeScript versions:

```json
{
  "types": "./types/index.d.ts",
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "default": "./index.js"
    }
  }
}
```

## Expected Output After Running `tsc`

After executing `tsc --project packages/core/tsconfig.json`, the following files should appear:

```
packages/core/types/
├── index.d.ts
├── index.d.ts.map
├── validate.d.ts
├── validate.d.ts.map
├── graph-engine.d.ts
└── graph-engine.d.ts.map
```

### What `types/index.d.ts` Should Contain

The generated `index.d.ts` should re-export all public symbols from the other two modules, plus export the `schema`, `taxonomy`, `nodeTypes`, and `edgeTypes` constants. Specifically, expect exports for:

- `validate` -- function with the signature from JSDoc annotations
- `MPCGGraph` -- class declaration with typed constructor and all public methods
- `schema` -- the parsed schema object
- `taxonomy` -- the parsed taxonomy object
- `nodeTypes` -- `string[]`
- `edgeTypes` -- `string[]`

### What `types/validate.d.ts` Should Contain

- The `validate` function signature with `graph` parameter and optional `options` parameter
- Type aliases for `ValidateOptions`, `ValidationResult`, `ValidationStats`
- Any other `@typedef` types defined in the JSDoc of `validate.js`

### What `types/graph-engine.d.ts` Should Contain

- The `MPCGGraph` class declaration with constructor and all 11 public methods typed
- Type aliases for `MPCGNode`, `MPCGEdge`, `GraphStats`, `CausalChainEntry`, `Contradiction`, `ProvenanceResult`, `FilteredGraph`

## Handling Loose Types for JSON Exports

When `tsc` processes the `index.js` file, the `schema` and `taxonomy` constants (loaded via `readFileSync` + `JSON.parse`) may be typed as `any` in the generated declarations because `tsc` cannot infer the JSON structure from a runtime `JSON.parse` call.

If this happens, there are two options:

1. **Add JSDoc casts in `index.js`**: Use `@type` annotations to give the parsed JSON a more specific type. For example:
   ```javascript
   /** @type {{ $defs: { NodeType: { enum: string[] }, EdgeType: { enum: string[] } } }} */
   const schema = JSON.parse(readFileSync(join(__dirname, 'schema.json'), 'utf-8'));
   ```

2. **Create a supplementary type file**: Write a hand-authored `packages/core/types/schema-types.d.ts` that provides explicit interfaces for the schema and taxonomy shapes, then use module augmentation or a triple-slash reference to integrate it.

Option 1 is simpler and keeps everything in one place. Only resort to Option 2 if the schema/taxonomy types need to be very detailed for consumer use.

## Integration with Build Pipeline

The type generation step is the second phase of the build process (Section 6 handles the full build script). The sequence is:

1. `clean` -- remove `types/` directory and copied files
2. `build` -- copy `schema.json`, `taxonomy.json`, `graph-engine.js` from `src/` into `packages/core/`
3. `tsc --project tsconfig.json` -- generate `.d.ts` files into `types/`

The `tsc` command must run **after** the copy step because `validate.js` and `graph-engine.js` import from co-located files (`./validate.js` imports are resolved relative to the file). If `graph-engine.js` is not yet present when `tsc` runs, the compilation will fail with module-not-found errors.

The `tsc` invocation is part of the `build` script in `packages/core/package.json`:

```json
{
  "scripts": {
    "build": "node scripts/build.js && tsc"
  }
}
```

The bare `tsc` command (without `--project`) works because `tsc` automatically finds `tsconfig.json` in the current working directory. Since pnpm runs scripts with `cwd` set to the package directory (`packages/core/`), this resolves correctly. Alternatively, use `tsc --project tsconfig.json` for explicitness.

## Troubleshooting

Common issues when setting up the pipeline:

- **"Cannot find module './validate.js'"** during `tsc`: The source files have not been copied yet. Ensure the build script runs the copy step before `tsc`.
- **All types come out as `any`**: The JSDoc annotations from Section 4 are missing or malformed. Verify that `tsc --noEmit` on each `.js` file passes without errors first.
- **"Option 'moduleResolution' must be set to 'Node16' when option 'module' is set to 'Node16'"**: If `module` is changed to `"Node16"` (capital N), `moduleResolution` must also be `"Node16"`. The config above uses `"ES2020"` for module to avoid this coupling.
- **Declaration files not appearing**: Check that `declarationDir` points to `"./types"` (relative to tsconfig location) and that the `include` array lists the correct `.js` filenames.

---

## Implementation Notes (Post-Implementation)

### Files Created/Modified
- `packages/core/tsconfig.json` — New, TypeScript declaration generation config
- `packages/core/package.json` — Added top-level `"types"` fallback field
- `packages/core/tests/typescript-pipeline.test.js` — New, 9 test cases

### Deviations from Plan
1. **`module` set to `"node16"` instead of `"ES2020"`** — tsc 5.9 enforces TS5110: module must be Node16 when moduleResolution is Node16. Plan's ES2020 module setting no longer works. Source files already use .js extensions so node16 module resolution is correct.
2. **`skipLibCheck: true` added** — Not in plan. Required to suppress ajv/ajv-formats CJS type export issues (same as tsconfig.jsdoc-check.json).

### Generated Output (after tsc)
- `types/index.d.ts` + `.map` — exports validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes
- `types/validate.d.ts` + `.map` — MPCGNode, MPCGEdge, MPCGGraphInput, ValidateOptions, ValidationStats, ValidationResult
- `types/graph-engine.d.ts` + `.map` — MPCGGraph class, GraphStats, CausalChainEntry, Contradiction, ProvenanceResult, FilteredGraph

### Test Count: 9 (all passing)