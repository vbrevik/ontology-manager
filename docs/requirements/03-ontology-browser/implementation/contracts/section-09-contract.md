# Section 09: Integration Testing — Prompt Contract

## GOAL
Write component integration tests for cross-component interaction and Playwright E2E test specs for full browser workflow.

## CONTEXT
All 8 previous sections are implemented. Unit tests pass (120). This section adds the integration layer testing cross-component interactions and E2E browser tests.

## CONSTRAINTS
- Integration tests use Vitest + @testing-library/react with mocked API
- E2E tests follow existing Playwright conventions (baseURL 127.0.0.1:5300, auth pattern)
- Integration tests must render full OntologyBrowser, not individual components

## FORMAT
- `frontend/src/features/ontology/components/OntologyBrowser.integration.test.tsx` (create)
- `frontend/tests/ontology-browser.spec.ts` (create)

## FAILURE CONDITIONS
- SHALL NOT break existing unit tests
- SHALL NOT use real API calls in integration tests (mock all API functions)
