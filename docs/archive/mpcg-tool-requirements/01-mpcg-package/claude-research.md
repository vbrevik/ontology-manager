# Research Findings: @mpcg/core Package

## Part 1: Codebase Analysis

### Project Structure

**Location:** `/Users/vidarbrevik/projects/universal-context-model`
**Module Format:** ES Modules (`"type": "module"` in package.json, Node.js ES2020)

Key directories:
- `/src/` — Core source (7 JS files, 2 JSON schema files)
- `/src/tests/` — Test suite (2 test files, Node built-in test framework)
- `/src/scenarios/` — 56 real-world validation scenarios
- `/docs/` — Documentation and constraints

### Source Files to Package

#### src/schema.json (784 lines)
- JSON Schema 2020-12 defining the MPCG context graph
- Root fields: `id` (UUID), `nodes`, `edges`, optional metadata (`domain`, `timestamp`, `perspective`, `provenance`, `security`, `operational_mode`, `related_graphs`)
- `$defs` section: `NodeType` enum (127+ types), `EdgeType` enum (100+ types), `ContextNode`, `ContextEdge` definitions
- Security model: STANAG 4774 classification, GDPR data protection, intelligence value decay
- Operational modes: normal, elevated, triage, crisis, recovery
- Perspective tracking: agent_id, confidence, timestamp

#### src/taxonomy.json (527 lines)
- Two-level structure: `nodeTypes` and `edgeTypes`
- Each entry: `description` + `subtypes` (hierarchical parent-child)
- Node families: Entity, Occurrence, Condition, Information, Force, Role
- Edge categories: Causal, Structural, Temporal, Informational, Agentive, Relational, Epistemic, Provenance, Logical, Symbolic, Modal, Embodied, Deceptive, Teleological

#### src/validate.js (214 lines)
- Single named export: `validate(graph)` function
- Loads schema.json and taxonomy.json via `readFileSync` with `__dirname` resolution
- Uses AJV 2020 + ajv-formats for JSON Schema validation
- 8 validation phases: schema validation, ID uniqueness, type validity, referential integrity, domain/range constraints, security labels, orphan detection
- Returns: `{ valid, errors[], warnings[], stats: { nodes, edges, nodeTypes, edgeTypes, errors, warnings } }`
- Has CLI mode: `node src/validate.js <graph.json>`

**Key packaging concern:** Uses `readFileSync` with `__dirname` to load schema.json and taxonomy.json — will need path resolution that works from the installed package location.

#### src/graph-engine.js (154 lines)
- Exports: `MPCGGraph` class
- Constructor validates via `validate()`, builds 4 indices: `_outgoing`, `_incoming`, `_byType`, `_edgesByType`
- 11 public methods: `findByType`, `getNode`, `outgoing`, `incoming`, `edgesOfType`, `causalChain`, `beliefsOf`, `contradictions`, `provenance`, `visibleAt`, `stats`
- `causalChain` does BFS on causal edge types (causes, enables, transforms, disrupts, amplifies, cascades_to, overwhelms)
- `visibleAt` filters by Norwegian security classifications (UGRADERT → STRENGT HEMMELIG)

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `ajv` | ^8.17.1 | JSON Schema 2020-12 validation |
| `ajv-formats` | ^3.0.1 | Format validation (UUID, datetime) |
| `@anthropic-ai/sdk` | ^0.39.0 | Anthropic API (autoresearch — NOT needed for core) |
| `neo4j-driver` | ^6.0.1 | Neo4j driver (NOT needed for core) |

**Only `ajv` and `ajv-formats` are runtime dependencies for the package.**

### Testing Setup

**Framework:** Node's built-in `node:test` module (Node.js 18+)
**Runner:** `npm test` → `node --test src/tests/*.test.js`

**Test files:**
1. `src/tests/graph-engine.test.js` (155 lines) — Integration tests with NATO intelligence scenario (14 nodes, 15 edges). Tests: graph loading, findByType, causalChain, beliefsOf, contradictions, provenance, visibleAt, stats
2. `src/tests/adversarial.test.js` (160 lines) — Negative tests per Red Team F6: duplicate IDs, bad references, invalid types, out-of-range weights, domain/range violations, orphan detection

### Import/Export Patterns

- All files use ESM: `import`/`export`, no `require()`
- Relative imports always use `.js` extension: `import { validate } from "./validate.js"`
- `__dirname` emulation: `const __dirname = dirname(fileURLToPath(import.meta.url))`
- External: `import Ajv2020 from "ajv/dist/2020.js"`, `import addFormats from "ajv-formats"`

---

## Part 2: npm ES Module Packaging (2025 Best Practices)

### Package.json Configuration

**ESM-only package (recommended for new packages):**
```json
{
  "name": "@mpcg/core",
  "type": "module",
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "default": "./index.js"
    }
  }
}
```

Key rules:
- `"types"` condition MUST come before `"default"` for TypeScript resolution
- All target paths must start with `./`
- `"exports"` black-boxes the package — only explicitly exported paths are accessible
- Consumers need `moduleResolution: "Node16"`, `"NodeNext"`, or `"Bundler"` in tsconfig
- Keep both `"main"` and `"exports"` for backward compatibility during migration

### The `"files"` field
```json
{
  "files": [
    "index.js",
    "validate.js",
    "graph-engine.js",
    "schema.json",
    "taxonomy.json",
    "types/"
  ]
}
```
Explicit inclusion controls what gets published. Exclude tests, scenarios, scripts.

### Build safeguards
- `"prepublishOnly": "npm run build"` ensures fresh compilation
- Validate with [publint](https://publint.dev/) and [Are the Types Wrong?](https://arethetypeswrong.github.io/)
- Self-reference package by name in tests to verify exports

### 2025 consensus
ESM-only is recommended for new packages. Dual CJS/ESM adds complexity (separate `.d.cts`/`.d.mts` files, separate entry points). Only needed for large existing CJS consumer bases — not applicable here.

---

## Part 3: TypeScript .d.ts from JSDoc

### Generated vs. Hand-written

| Aspect | Generated from JSDoc | Hand-written .d.ts |
|--------|--------------------|--------------------|
| Sync with source | Automatic | Can drift |
| Type coverage | Forces JSDoc on all public API | Only describes public surface |
| Complexity | JSDoc verbose for complex types | Full TS syntax |
| Build step | Requires `tsc` | None |
| Best for | Active codebases | Stable APIs |

**Recommendation for @mpcg/core:** Hand-written `.d.ts` is likely better because:
1. The existing JS has no JSDoc annotations — adding them retroactively is high-effort
2. The public API is small and well-defined (spec already lists all exports)
3. Complex types (graph structures, security models) are easier in pure TypeScript syntax
4. The API is relatively stable (schema-driven, not frequently changing)

### If generating from JSDoc later
```json
// tsconfig.build.json
{
  "compilerOptions": {
    "allowJs": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationDir": "types",
    "declarationMap": true
  },
  "include": ["src/**/*.js"]
}
```

### Publishing workflow
1. Add `"types"` to `"exports"` conditions (must come before `"default"`)
2. Include `types/` in `"files"`
3. Either commit hand-written types or generate + commit via build script

---

## Part 4: Monorepo Package Structure

### Applicable Pattern

The spec proposes `packages/core/` structure. Given this is one package extracted from a single project:

**Simplest approach (recommended):** Use a `packages/core/` directory with its own `package.json` but without npm workspaces initially. The root project doesn't need to be a workspace — the package just needs to be independently publishable.

```
universal-context-model/
├── package.json           # root project (unchanged)
├── src/                   # existing source
├── packages/
│   └── core/
│       ├── package.json   # @mpcg/core package
│       ├── index.js       # re-exports
│       └── types/
│           └── index.d.ts
```

### File Resolution Challenge

**Critical issue:** `validate.js` loads `schema.json` and `taxonomy.json` via `readFileSync` with `__dirname` path resolution. When packaged, these files must be co-located with `validate.js` or the paths must be updated.

**Options:**
1. **Copy files** into `packages/core/` (duplicates, drift risk)
2. **Symlink files** (`schema.json → ../../src/schema.json`) — works for dev, breaks on npm publish
3. **Modify validate.js** to accept schema/taxonomy as parameters instead of loading from filesystem
4. **Build script** copies files into package directory before publish

**Recommended:** Option 4 (build script copies) for publishing, with option 3 as a future refactor. The build script ensures published package is self-contained while keeping single source of truth.

### Workspace setup (if needed later)

Root package.json:
```json
{
  "private": true,
  "workspaces": ["packages/*"]
}
```

This enables `npm install` in root to symlink `packages/core` into `node_modules/@mpcg/core`, making it importable by other packages. Not needed for single-package extraction.

---

## Key Decisions for Planning

1. **ESM-only** — no CJS support needed (project is already ESM)
2. **Hand-written .d.ts** — recommended over JSDoc generation (no existing annotations, small stable API)
3. **packages/core/ without workspaces** — simplest extraction, add workspaces when API/web packages arrive
4. **Build script copies** schema.json + taxonomy.json into package — resolves path issues
5. **validate.js path resolution** — must work from installed package location, not just source tree
6. **Only ajv + ajv-formats** as runtime dependencies
7. **Existing tests** must pass when importing from the package path
