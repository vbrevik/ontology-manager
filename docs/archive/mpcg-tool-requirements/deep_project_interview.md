# Deep Project Interview — MPCG Platform

## Q1: First use case?
**A: Browse the taxonomy visually.** The most immediate need is to see and explore the type hierarchy interactively.

## Q2: Access method?
**A: Local web app.** Localhost web UI, no deployment, reads from project files.

## Q3: Features for first release?
**A: All four:**
1. Graph visualization — paste/load MPCG graph, see as interactive nodes and edges
2. Live validation — real-time error/warning display
3. Query interface — find contradictions, trace provenance, follow causal chains
4. Scenario browser — browse the 56 test scenarios

## Q4: Tech stack?
**A: React + Vite** for frontend (component model, graph viz ecosystem)
**A: Node.js API server** (Express/Fastify) reading project files, serving via REST

## Q5: npm package?
**A: Include it now.** Package existing validate.js and graph-engine.js as importable module alongside the web app. Code already exists.

## Summary of Decisions
- Local-first, no cloud dependencies
- React + Vite frontend, Node.js API backend
- Five deliverables: taxonomy browser, graph visualizer, validator, query interface, scenario browser
- Plus npm package for reuse in other projects
- Reads directly from existing project files (schema.json, taxonomy.json, scenarios/)
- Security labels must be respected in visualization
