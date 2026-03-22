# TDD Plan: Ontology Browser as Core Feature

Testing stack: Vitest 3.0.5 + jsdom + @testing-library/react + @testing-library/jest-dom. Playwright for E2E. Test files colocate with source as `*.test.tsx`.

---

## Section 1: Route Creation, Redirect, and Cleanup

No unit tests needed for route files — TanStack Router file-based routes are validated by the build system. The redirect is tested via E2E in Section 4.

---

## Section 2: Navigation Update

No dedicated unit tests for MainSidebar nav items — the sidebar is a presentational component. Verify visually and via E2E in Section 4.

---

## Section 3: Detail Panel Tabs

**File:** `frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx`

Tests to write BEFORE modifying ClassDetail:

```
# Test: renders three tabs when a class is selected (Detail, Graph, Relationships)
# Test: Detail tab is active by default and shows class content (heading, properties)
# Test: Graph tab renders placeholder with icon and description text
# Test: Relationships tab renders placeholder with icon and description text
# Test: no tabs render when no class is selected (placeholder only)
# Test: switching classes resets to Detail tab (key-based remount)
```

Mock shadcn Tabs if needed (check if existing test setup already handles it). The tests should use `screen.getByRole('tab')` and `screen.getByRole('tabpanel')` for accessible selectors.

---

## Section 4: Testing (E2E Updates)

**File:** `frontend/tests/ontology-browser.spec.ts`

Tests to update/add:

```
# Update: all page.goto calls change from '/admin/ontology/browser' to '/ontology'
# Test: navigating to /admin/ontology/browser redirects to /ontology
# Test: selecting a class shows three tab triggers in the detail panel
# Test: clicking Graph tab shows placeholder content
# Test: clicking Relationships tab shows placeholder content
```

**File:** `frontend/src/features/ontology/components/OntologyBrowser.integration.test.tsx`

```
# Verify: existing integration tests still pass without modification
```
