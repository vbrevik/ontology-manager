# Section 1: pnpm Workspace Foundation

## Overview

This section converts the Universal Context Model project from a standalone npm project into a pnpm workspace monorepo. It creates the workspace configuration at the project root and sets up the `@mpcg/core` package skeleton under `packages/core/`. No source code is moved or modified -- this section only establishes the infrastructure that all subsequent sections build upon.

## Dependencies

None. This is the first section and has no prerequisites.

## Tests First

These are workspace setup validation checks, not traditional unit tests. They verify the structural correctness of the workspace configuration after implementation. Create a validation script at `/Users/vidarbrevik/projects/universal-context-model/packages/core/tests/workspace-setup.test.js` using the existing `node:test` + `node:assert` conventions.

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('pnpm workspace foundation', () => {
  it('pnpm-workspace.yaml exists at project root', () => {
    assert.ok(existsSync(join(ROOT, 'pnpm-workspace.yaml')));
  });

  it('pnpm-workspace.yaml contains packages/* glob', () => {
    const content = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf-8');
    assert.ok(content.includes('packages/*'), 'should contain packages/* glob');
  });

  it('root package.json has "private": true', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    assert.strictEqual(pkg.private, true);
  });

  it('root package.json retains existing dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    assert.ok(pkg.dependencies.ajv, 'should retain ajv');
    assert.ok(pkg.dependencies['ajv-formats'], 'should retain ajv-formats');
  });

  it('root package.json retains existing scripts', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    assert.ok(pkg.scripts.test, 'should retain test script');
  });

  it('packages/core/package.json exists with name @mpcg/core', () => {
    const corePkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
    );
    assert.strictEqual(corePkg.name, '@mpcg/core');
  });

  it('packages/core/package.json has "type": "module"', () => {
    const corePkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
    );
    assert.strictEqual(corePkg.type, 'module');
  });

  it('packages/core/package.json has engines >= 20', () => {
    const corePkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
    );
    assert.strictEqual(corePkg.engines.node, '>=20');
  });

  it('packages/core/package.json has ajv and ajv-formats as dependencies', () => {
    const corePkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
    );
    assert.ok(corePkg.dependencies.ajv);
    assert.ok(corePkg.dependencies['ajv-formats']);
  });

  it('packages/core/package.json has "private": true', () => {
    const corePkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
    );
    assert.strictEqual(corePkg.private, true);
  });

  it('pnpm install succeeds and @mpcg/core is symlinked', () => {
    // This test should be run after `pnpm install` has been executed.
    // It checks that the symlink exists in node_modules.
    const symlinkPath = join(ROOT, 'node_modules', '@mpcg', 'core');
    assert.ok(existsSync(symlinkPath), '@mpcg/core should be linked in node_modules');
  });
});
```

Run with: `node --test packages/core/tests/workspace-setup.test.js` from the project root, but only after completing all implementation steps below (including `pnpm install`).

## Implementation

### Step 1: Create `pnpm-workspace.yaml`

**File:** `/Users/vidarbrevik/projects/universal-context-model/pnpm-workspace.yaml`

Create this file at the project root with the following content:

```yaml
packages:
  - 'packages/*'
```

This tells pnpm to look for workspace packages in any directory under `packages/`. All sibling packages created in the future (API server, web frontend) will follow this convention.

### Step 2: Update root `package.json`

**File:** `/Users/vidarbrevik/projects/universal-context-model/package.json`

Add `"private": true` to prevent accidental publishing of the root package. The existing content must remain unchanged. The result should look like:

```json
{
  "name": "universal-context-model",
  "version": "0.1.0",
  "description": "A data model describing context as universally as possible, evolved via autoresearch",
  "type": "module",
  "private": true,
  "scripts": {
    "evaluate": "node src/evaluate.js",
    "generate-owl": "node src/generate-owl.js",
    "test": "node --test src/tests/*.test.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "neo4j-driver": "^6.0.1"
  }
}
```

Key constraint: do NOT remove or modify any existing `dependencies` or `scripts`. Only add `"private": true`.

### Step 3: Remove `package-lock.json` if present

**File:** `/Users/vidarbrevik/projects/universal-context-model/package-lock.json`

If a `package-lock.json` exists at the project root, delete it. pnpm uses its own `pnpm-lock.yaml` lockfile and the two should not coexist.

### Step 4: Create `packages/core/` directory structure

Create the directory:

```
packages/
  core/
    tests/
```

### Step 5: Create `packages/core/package.json`

**File:** `/Users/vidarbrevik/projects/universal-context-model/packages/core/package.json`

```json
{
  "name": "@mpcg/core",
  "version": "1.0.0",
  "description": "MPCG (Multi-Perspective Context Graph) core library — schema, validation, and graph engine",
  "type": "module",
  "private": true,
  "engines": {
    "node": ">=20"
  },
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "default": "./index.js"
    }
  },
  "files": [
    "index.js",
    "validate.js",
    "graph-engine.js",
    "schema.json",
    "taxonomy.json",
    "types/"
  ],
  "scripts": {
    "clean": "rm -rf types/ schema.json taxonomy.json graph-engine.js",
    "prebuild": "npm run clean",
    "build": "node scripts/build.js && tsc",
    "test": "node --test tests/*.test.js",
    "test:types": "tsc --noEmit --project tsconfig.test.json"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

Key decisions:
- `"private": true` -- this package is consumed only via pnpm workspace linking, not published to npm.
- `"exports"` field with `"types"` condition listed before `"default"` -- required for TypeScript module resolution to find the `.d.ts` files.
- `"engines": { "node": ">=20" }` -- matches the Node.js built-in test runner requirements and `import.meta.dirname` usage.
- The `dependencies` mirror what the source code needs (ajv, ajv-formats). These will be installed into the package's own `node_modules` by pnpm's strict isolation.
- The `scripts` entries are placeholders that will become functional once later sections create the referenced files (`scripts/build.js`, `tsconfig.json`, `tsconfig.test.json`, test files).

### Step 6: Set up `.gitignore` entries

**File:** `/Users/vidarbrevik/projects/universal-context-model/packages/core/.gitignore`

Create a `.gitignore` within the core package to exclude build artifacts:

```
# Build artifacts - copied from src/
schema.json
taxonomy.json
graph-engine.js

# Generated TypeScript declarations
types/
```

These files are generated by the build script (Section 6). The source of truth for `schema.json`, `taxonomy.json`, and `graph-engine.js` remains in `src/`. The `validate.js` and `index.js` in `packages/core/` are NOT listed here because they contain package-specific modifications and should be committed to version control.

### Step 7: Run `pnpm install`

From the project root, run:

```bash
pnpm install
```

This will:
1. Read `pnpm-workspace.yaml` and discover `packages/core` as a workspace member
2. Create `pnpm-lock.yaml` at the project root
3. Install dependencies for both the root and `packages/core`
4. Create a symlink at `node_modules/@mpcg/core` pointing to `packages/core/`

After this step, any package in the workspace can declare `"@mpcg/core": "workspace:*"` in its dependencies and import from it.

## Verification

After completing all steps, run the workspace setup tests:

```bash
cd /Users/vidarbrevik/projects/universal-context-model
node --test packages/core/tests/workspace-setup.test.js
```

Also verify that existing tests still pass:

```bash
pnpm test
```

This runs the root-level test script (`node --test src/tests/*.test.js`) and should report all 22 existing tests passing, confirming the workspace conversion did not break anything.

## Files Created/Modified

| File | Action |
|------|--------|
| `pnpm-workspace.yaml` | Created |
| `package.json` (root) | Modified -- added `"private": true` |
| `package-lock.json` (root) | Deleted if present |
| `packages/core/package.json` | Created |
| `packages/core/.gitignore` | Created |
| `packages/core/tests/workspace-setup.test.js` | Created |

## What This Section Does NOT Do

- Does not create `index.js`, `validate.js`, or `graph-engine.js` in `packages/core/` (Section 2 and 3)
- Does not create `tsconfig.json` (Section 5)
- Does not create the build script (Section 6)
- Does not modify any files in `src/`
- Does not move or copy source files