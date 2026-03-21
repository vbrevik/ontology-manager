<!-- PROJECT_CONFIG
runtime: typescript-pnpm
test_command: pnpm --filter @mpcg/api test
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-package-setup
section-02-error-handling
section-03-taxonomy-routes
section-04-scenario-loader
section-05-validation-route
section-06-graph-routes
section-07-constraint-routes
section-08-integration-tests
END_MANIFEST -->

# Implementation Sections Index

## Dependency Graph

| Section | Depends On | Blocks | Parallelizable |
|---------|------------|--------|----------------|
| section-01-package-setup | - | all | Yes |
| section-02-error-handling | 01 | 03, 04, 05, 06, 07 | No |
| section-03-taxonomy-routes | 02 | 08 | Yes |
| section-04-scenario-loader | 02 | 08 | Yes |
| section-05-validation-route | 02 | 08 | Yes |
| section-06-graph-routes | 02 | 08 | Yes |
| section-07-constraint-routes | 02 | 08 | Yes |
| section-08-integration-tests | 03, 04, 05, 06, 07 | - | No |

## Execution Order

1. section-01-package-setup (no dependencies)
2. section-02-error-handling (after 01)
3. section-03-taxonomy-routes, section-04-scenario-loader, section-05-validation-route, section-06-graph-routes, section-07-constraint-routes (parallel after 02)
4. section-08-integration-tests (final — after all routes)

## Section Summaries

### section-01-package-setup
Package.json, pnpm workspace integration, app.js factory, server.js entry point, middleware stack (CORS, JSON parsing), test infrastructure with supertest, shared test fixtures.

**Plan sections:** 2 (Project Structure), 3 (Package Configuration), 4 (App Factory & Middleware)

### section-02-error-handling
RFC 7807 Problem Details factory, ApiError class, centralized Express error handler (4-param), 404 handler, Content-Type: application/problem+json, STIG compliance for error messages.

**Plan sections:** 5 (Error Handling)

### section-03-taxonomy-routes
Routes for GET /api/taxonomy, /api/schema, /api/types/nodes, /api/types/edges, /api/types/search. Taxonomy tree flattening, case-insensitive search across names and descriptions.

**Plan sections:** 6 (Taxonomy & Schema Routes)

### section-04-scenario-loader
lib/scenarios.js for recursive scenario file loading, graph construction from expected_entities/expected_relationships, UUID generation, label-based edge resolution, caching. Routes for GET /api/scenarios, /api/scenarios/groups, /api/scenarios/:id.

**Plan sections:** 7 (Scenario Routes)

### section-05-validation-route
POST /api/validate endpoint. Input validation, @mpcg/core validate() delegation, response passthrough.

**Plan sections:** 8 (Validation Route)

### section-06-graph-routes
In-memory graph store, POST /api/graph/load, DELETE /api/graph/:id, all GET query endpoints (stats, contradictions, beliefs, provenance, causal-chain, visible). Graph lookup middleware, classification validation, maxDepth parameter.

**Plan sections:** 9 (Graph Routes)

### section-07-constraint-routes
Static domain/range rules extraction, algebraic properties definition. GET /api/constraints/domain-range, GET /api/constraints/algebra.

**Plan sections:** 10 (Constraint Routes)

### section-08-integration-tests
End-to-end tests verifying full request lifecycle: load graph → query it → validate results. Cross-route integration scenarios. Error response format consistency. STIG compliance verification.

**Plan sections:** 11 (Testing Strategy) — integration subset
