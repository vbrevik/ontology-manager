# MPCG Platform — Requirements

## Vision

Build a platform that lets users **see, test, and integrate** the Multi-Perspective Context Graph (MPCG) ontology. The ontology exists as JSON Schema + taxonomy files. It needs to become a living tool that people can interact with, validate against, and consume in their own projects.

## Problem

The MPCG v2.0 ontology has 144 node types, 98 edge types, 56 test scenarios, a validator, a graph engine, and extensive documentation. But it only exists as files in a git repo. There is no way to:

1. **Visualize** the type hierarchy and browse it interactively
2. **Encode** a real-world situation into an MPCG graph through a UI
3. **Validate** a graph and see errors/warnings visually
4. **Query** encoded graphs (find contradictions, trace provenance, follow causal chains)
5. **Import/Export** MPCG graphs in other projects (npm package, API, file format)
6. **Compare** how different encoders represent the same scenario

## Users

- **The ontology designer** (me) — needs to browse, test, and evolve the taxonomy
- **Developers** building systems that need context modeling — need an npm package or API
- **Analysts** who want to encode real-world situations and query them
- **Reviewers** evaluating whether the ontology fits their domain

## Known Constraints

- The ontology lives at `/Users/vidarbrevik/projects/universal-context-model/`
- Existing code: `src/schema.json`, `src/taxonomy.json`, `src/validate.js`, `src/graph-engine.js`
- Node.js ecosystem (ES modules)
- Should work locally without cloud dependencies
- Security labels (STANAG 4774) must be respected in any visualization
- The graph engine already supports: findByType, causalChain, beliefsOf, contradictions, provenance, visibleAt

## What Success Looks Like

1. I can open a browser and see the full type hierarchy as an interactive tree
2. I can paste or build a context graph and see it validated in real-time
3. I can visualize a graph as nodes and edges with type-colored styling
4. I can run queries against loaded graphs and see results
5. Other projects can `npm install` or import the schema, types, and validator
6. The whole thing runs locally with no external dependencies
