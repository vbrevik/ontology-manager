# Interview Transcript — MPCG REST API

## Q1: Framework Choice
**Q:** The spec mentions Express.js or Fastify. Given that @mpcg/core uses ESM and Node's built-in test runner, do you have a preference?

**A:** Express.js

## Q2: Graph IDs
**Q:** Should the server auto-generate UUIDs for loaded graphs, or should clients provide their own graph IDs?

**A:** Use the graph's own ID — the `graph.id` field from the input becomes the key in the store.

## Q3: In-Memory Store Policy
**Q:** For the in-memory graph store, should there be any eviction policy?

**A:** Simple Map, no limits — suitable for dev/demo use.

## Q4: Data Source for Schema/Taxonomy
**Q:** Should the API use @mpcg/core's exports or read files directly via MPCG_PROJECT_DIR?

**A:** Use @mpcg/core exports — import schema/taxonomy from the package; only read scenarios/ from disk.

## Q5: Scenario Data Handling
**Q:** The scenarios contain expected_entities and expected_relationships (test expectations), not fully constructed graphs. Should the API serve these raw or construct actual graphs?

**A:** Construct graphs from scenarios — build actual MPCG graphs from expected_entities/relationships and serve those.

## Q6: Authentication
**Q:** Should the API include any authentication?

**A:** No auth — local dev only. Open access, CORS for localhost:5173 only.

## Q7: Graph Construction from Scenarios
**Q:** For constructing graphs from scenario files, nodes need IDs and edges reference node IDs. What approach for ID generation?

**A:** Auto-generate UUIDs, match by label — create node IDs from UUIDs, resolve edge source/target by finding nodes with matching labels.

## Q8: Constraint Endpoints
**Q:** The spec lists /api/constraints/* endpoints but @mpcg/core doesn't expose these as standalone data. Extract and serve, or defer?

**A:** Extract and serve as static data — parse the rules from validate.js and serve them as JSON.

## Q9: Type Search Behavior
**Q:** For /api/types/search?q=belief, should this search node types, edge types, or both? Names only or also descriptions?

**A:** Both types, names + descriptions — search across all node and edge types, matching in both name and description fields from the taxonomy.

## Q10: Error Response Format
**Q:** Any specific error response format?

**A:** RFC 7807 Problem Details — standard format: `{ type, title, status, detail }`
