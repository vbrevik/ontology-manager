<!-- PROJECT_CONFIG
runtime: typescript-pnpm
test_command: cd frontend && pnpm vitest run
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-route-and-redirect
section-02-navigation
section-03-detail-panel-tabs
section-04-testing
END_MANIFEST -->

# Implementation Sections Index

## Dependency Graph

| Section | Depends On | Blocks | Parallelizable |
|---------|------------|--------|----------------|
| section-01-route-and-redirect | - | 02, 04 | Yes |
| section-02-navigation | 01 | 04 | No |
| section-03-detail-panel-tabs | - | 04 | Yes |
| section-04-testing | 01, 02, 03 | - | No |

## Execution Order

1. section-01-route-and-redirect, section-03-detail-panel-tabs (parallel, no dependencies)
2. section-02-navigation (after 01)
3. section-04-testing (after all)

## Section Summaries

### section-01-route-and-redirect
Create new top-level route at `/ontology` using `ontology.index.tsx`. Replace old browser route with redirect to `/ontology`. Regenerate route tree.

### section-02-navigation
Add "Ontology" nav item to MainSidebar as second entry (after Dashboard). Verify admin workspace sidebar has no browser link.

### section-03-detail-panel-tabs
Add shadcn Tabs to ClassDetail: Detail (working), Graph (stub), Relationships (stub). Key-based tab reset on class change. Pinned tab bar with scrollable content.

### section-04-testing
Add tab tests to ClassDetail.test.tsx. Update Playwright E2E route paths and add tab tests. Verify integration tests pass.
