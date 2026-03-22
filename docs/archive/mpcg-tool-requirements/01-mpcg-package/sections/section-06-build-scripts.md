# Section 6: Build and Copy Scripts

## Overview

This section creates the build infrastructure for the `@mpcg/core` package. A Node.js build script copies shared source files (`schema.json`, `taxonomy.json`, `graph-engine.js`) from `src/` into `packages/core/`, and package.json scripts wire up `clean`, `prebuild`, and `build` commands. The build script does NOT copy `validate.js` because the package maintains its own modified version with parameterization (from Section 3). A `.gitignore` ensures copied files and generated types are not committed.

## Dependencies

- **Section 02 (Package Structure):** `packages/core/package.json` must exist with the correct base configuration.
- **Section 03 (validate.js Parameterization):** The modified `validate.js` lives directly in `packages/core/` and is NOT a build artifact.
- **Section 05 (TypeScript Pipeline):** The `tsc` step in the build relies on `tsconfig.json` from Section 5. The build script itself only handles file copying; `tsc` is invoked separately via the `build` script in package.json.

## Tests First

These tests validate that the build script and associated scripts work correctly. Place them in `packages/core/tests/build.test.js` using Node.js built-in `node:test` and `node:assert`.

```javascript
// File: packages/core/tests/build.test.js
// Framework: node:test + node:assert
// Run with: node --test packages/core/tests/build.test.js
// NOTE: These tests require a clean state and execute the build script.

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const PKG = resolve(ROOT, 'packages', 'core');
const SRC = resolve(ROOT, 'src');

describe('build script', () => {
  it('scripts/build.js exists in packages/core/', () => {
    assert.ok(existsSync(join(PKG, 'scripts', 'build.js')));
  });

  it('running build script copies schema.json from src/ to packages/core/', () => {
    /** Run the build script, then assert packages/core/schema.json exists */
  });

  it('running build script copies taxonomy.json from src/ to packages/core/', () => {
    /** Run the build script, then assert packages/core/taxonomy.json exists */
  });

  it('running build script copies graph-engine.js from src/ to packages/core/', () => {
    /** Run the build script, then assert packages/core/graph-engine.js exists */
  });

  it('build script does NOT overwrite validate.js (it is maintained separately)', () => {
    /**
     * Write a sentinel value into packages/core/validate.js before running build.
     * After build, assert the sentinel is still present — proving the build script
     * did not overwrite it.
     */
  });

  it('copied schema.json is byte-identical to src/schema.json', () => {
    /** Compare readFileSync output of both files */
  });

  it('copied taxonomy.json is byte-identical to src/taxonomy.json', () => {
    /** Compare readFileSync output of both files */
  });

  it('copied graph-engine.js is byte-identical to src/graph-engine.js', () => {
    /** Compare readFileSync output of both files */
  });
});

describe('clean script', () => {
  it('clean removes types/, schema.json, taxonomy.json, graph-engine.js from packages/core/', () => {
    /**
     * Run build first (to create artifacts), then run clean.
     * Assert that types/, schema.json, taxonomy.json, graph-engine.js
     * no longer exist in packages/core/.
     */
  });
});

describe('.gitignore', () => {
  it('.gitignore includes packages/core/types/ and copied files', () => {
    /**
     * Read the project .gitignore (root or packages/core/.gitignore).
     * Assert it contains entries for:
     *   packages/core/types/
     *   packages/core/schema.json
     *   packages/core/taxonomy.json
     *   packages/core/graph-engine.js
     */
  });
});

describe('full build pipeline', () => {
  it('clean -> copy -> tsc completes without errors', () => {
    /**
     * Run `pnpm --filter @mpcg/core build` (which triggers prebuild/clean, then build).
     * Assert it exits with code 0.
     * NOTE: This test depends on Section 5 (tsconfig.json) being in place.
     */
  });
});
```

## Implementation Details

### File to Create: `packages/core/scripts/build.js`

This is a simple Node.js script that copies three files from `src/` to `packages/core/`. It does NOT copy `validate.js`.

```javascript
// File: packages/core/scripts/build.js
// Purpose: Copy shared source files from src/ into the package directory.
// validate.js is NOT copied — it is maintained separately in packages/core/
// with parameterization changes (see Section 3).

import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(__dirname, '..');
const srcDir = resolve(pkgDir, '..', '..', 'src');

/** Files to copy from src/ to packages/core/ (no modifications needed) */
const FILES_TO_COPY = [
  'schema.json',
  'taxonomy.json',
  'graph-engine.js',
];

// Implementation: iterate FILES_TO_COPY, copyFileSync each from srcDir to pkgDir.
// Log each copy operation for visibility.
```

Key implementation points:

- Use `copyFileSync` for simplicity -- no async needed for three small files.
- Resolve paths relative to the script's own location using `import.meta.url` so the script works regardless of the current working directory.
- The `srcDir` is resolved as `packages/core/scripts/../../.src` which equals the project root's `src/` directory.
- `validate.js` is explicitly excluded from the copy list. It lives in `packages/core/` as a committed, hand-maintained file with parameterization changes from Section 3.
- Log each file copy to stdout (e.g., `console.log('Copied schema.json')`) so build output is visible.

### File to Modify: `packages/core/package.json`

Add these scripts to the existing `packages/core/package.json` (created in Section 1):

```json
{
  "scripts": {
    "clean": "rm -rf types/ schema.json taxonomy.json graph-engine.js",
    "prebuild": "npm run clean",
    "build": "node scripts/build.js && tsc",
    "test": "node --test tests/*.test.js",
    "test:types": "tsc --noEmit --project tsconfig.test.json"
  }
}
```

Script explanations:

- **`clean`**: Removes all build artifacts from `packages/core/`. This includes the `types/` directory (generated `.d.ts` files from Section 5) and the three copied source files. It does NOT remove `validate.js` or `index.js` since those are committed source files.
- **`prebuild`**: Automatically runs before `build` (npm/pnpm lifecycle hook). Ensures a clean state before every build.
- **`build`**: Two steps chained with `&&`. First, `node scripts/build.js` copies the three source files from `src/`. Second, `tsc` generates TypeScript declaration files (requires `tsconfig.json` from Section 5). If the copy step fails, `tsc` is skipped.
- **`test`** and **`test:types`**: Included here for completeness but are implemented in Section 7.

### File to Create or Modify: `.gitignore`

Add entries to the project root `.gitignore` (or create `packages/core/.gitignore`) to exclude build artifacts:

```gitignore
# @mpcg/core build artifacts — copied from src/ by scripts/build.js
packages/core/schema.json
packages/core/taxonomy.json
packages/core/graph-engine.js

# @mpcg/core generated TypeScript declarations
packages/core/types/
```

These four entries ensure that:

1. The three copied files (`schema.json`, `taxonomy.json`, `graph-engine.js`) are not committed to git. Their source of truth is `src/`.
2. The generated `types/` directory (containing `.d.ts` and `.d.ts.map` files) is not committed. It is regenerated by `tsc` during every build.

Files that ARE committed in `packages/core/`:
- `package.json` -- package configuration
- `index.js` -- entry point with re-exports (Section 2)
- `validate.js` -- modified version with parameterization (Section 3)
- `tsconfig.json` -- TypeScript config (Section 5)
- `scripts/build.js` -- this build script
- `tests/` -- test files (Section 7)

### Build Workflow Summary

The complete build pipeline for `@mpcg/core`:

1. Developer runs `pnpm --filter @mpcg/core build`
2. pnpm triggers `prebuild` which runs `clean`, removing any previous artifacts
3. pnpm runs `build`:
   - `node scripts/build.js` copies `schema.json`, `taxonomy.json`, `graph-engine.js` from `src/` to `packages/core/`
   - `tsc` reads `tsconfig.json` and generates `.d.ts` files into `packages/core/types/`
4. The package is now ready for consumption by sibling workspace packages via `import { ... } from '@mpcg/core'`

### Path Resolution Details

The build script must resolve paths correctly regardless of the working directory. The resolution chain:

```
scripts/build.js location:  packages/core/scripts/build.js
Package root (pkgDir):      packages/core/           (.. from scripts/)
Project root:               .                        (../../ from packages/core/)
Source directory (srcDir):   src/                     (../../src/ from packages/core/)
```

This means `resolve(__dirname, '..')` gives the package root, and `resolve(__dirname, '..', '..', '..', 'src')` gives the source directory. The three-level traversal accounts for: `scripts/` -> `core/` -> `packages/` -> project root, then into `src/`.

---

## Implementation Notes (Post-Implementation)

### Files Created/Modified
- `packages/core/scripts/build.js` — New, copies schema.json and taxonomy.json from src/
- `packages/core/package.json` — Updated clean script (removed graph-engine.js)
- `.gitignore` — Added build artifact entries (schema.json, taxonomy.json, types/)
- `packages/core/tests/build.test.js` — New, 10 test cases
- `packages/core/tests/typescript-pipeline.test.js` — Fixed to run build.js before tsc

### Deviations from Plan
1. **graph-engine.js NOT copied by build script** — Plan said to copy it from src/, but section-04 added JSDoc annotations to the package version. Like validate.js, graph-engine.js is now maintained separately in packages/core/. Clean script also does not remove it. .gitignore does not exclude it.

### Test Count: 10 (all passing)
- build.js exists
- Copies schema.json and taxonomy.json
- Does NOT overwrite validate.js or graph-engine.js
- Byte-identical copies
- Clean removes artifacts, preserves source files
- .gitignore includes build artifacts
- Full pipeline (clean + copy + tsc) works