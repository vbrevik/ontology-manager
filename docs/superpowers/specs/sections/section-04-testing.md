I now have all the context needed. Let me produce the section content.

# Section 4: Testing

## Overview

This section adds unit tests for the tabbed detail panel (from section 3), updates the Playwright E2E test suite to use the new `/ontology` route (from section 1), and verifies that existing integration tests still pass. This section depends on all three prior sections being complete.

## Dependencies

- **Section 01 (Route and Redirect):** The new `/ontology` route must exist and the old `/admin/ontology/browser` must redirect to it.
- **Section 02 (Navigation):** The "Ontology" nav item must be present in MainSidebar.
- **Section 03 (Detail Panel Tabs):** ClassDetail must render shadcn Tabs (Detail, Graph, Relationships) when a class is selected, with `key={selectedClassId}` for tab reset on class change.

## Background

The testing stack uses Vitest 3.0.5 with jsdom and `@testing-library/react` for unit/integration tests. Playwright handles E2E tests. Test files are colocated with source as `*.test.tsx` (unit) or live in `frontend/tests/` (E2E).

The shadcn Tabs component (`@/components/ui/tabs`) is built on `@radix-ui/react-tabs` and exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`. Radix tabs render proper ARIA roles: `tab` for triggers and `tabpanel` for content areas. This means tests can use `screen.getByRole('tab')` and `screen.getByRole('tabpanel')` for accessible selectors.

## File 1: ClassDetail Unit Tests

**File:** `frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx`

**Action:** Add new test cases to the existing `describe('ClassDetail')` block.

The existing test file already has the full mock setup: it mocks `useOntologyBrowser`, `useClassTree`, `useClassDetail`, and shared components (`SourceBadge`, `ClassLink`). It uses mutable module-level variables (`mockSelectedClassId`, `mockClassData`, `mockProperties`, `mockIsLoading`) that are reset in `beforeEach`. The `renderWithProviders()` helper wraps the component in a `QueryClientProvider`.

### Tests to Add

Add the following six tests inside the existing `describe('ClassDetail')` block. They should appear after the existing five tests.

**Test: renders three tabs when a class is selected**

Set `mockSelectedClassId` to a class ID and provide `mockClassData` with a valid class object. After rendering, query for all elements with `role="tab"`. Assert that exactly three tabs are present and their accessible names are "Detail", "Graph", and "Relationships".

Use the same `mockClassData` pattern as the existing "renders ClassHeader and ClassProperties" test (class ID `cls-1`, name `Vehicle`, etc.).

**Test: Detail tab is active by default and shows class content**

Set up a selected class with properties. After rendering, assert that the Detail tab has `aria-selected="true"` (or use `data-state="active"` which is what Radix sets). Assert that the class heading ("Vehicle") and a property name ("speed") are visible in the document, confirming the Detail tab content is rendered.

**Test: Graph tab renders placeholder content**

Set up a selected class. Use `userEvent.click` on the tab with name "Graph". After clicking, assert that text matching "graph visualization" (case-insensitive) appears in the document. This confirms the stub tab renders its placeholder.

Note: Import `userEvent` from `@testing-library/user-event` -- this import needs to be added at the top of the file.

**Test: Relationships tab renders placeholder content**

Same pattern as the Graph tab test. Click the "Relationships" tab trigger and assert that text matching "relationship explorer" (case-insensitive) appears.

**Test: no tabs render when no class is selected**

Leave `mockSelectedClassId` as `null` (the default from `beforeEach`). After rendering, assert that `screen.queryByRole('tab')` returns `null`, and that the "Select a class" placeholder text is present. This confirms the tab bar is not rendered for the empty state.

**Test: switching classes resets to Detail tab**

This tests the `key={selectedClassId}` remount behavior. Set `mockSelectedClassId` to `cls-1` with valid class data and render. Click the "Graph" tab to switch away from Detail. Then update `mockSelectedClassId` to a different class ID (`cls-2`) and re-render (using `rerender` from the render result, or by unmounting and re-rendering with the new mock state). After re-render, assert that the Detail tab is active again (not Graph).

For the re-render approach: since the mocks use module-level variables, you can update `mockSelectedClassId` and `mockClassData`, then call `rerender()` with the same JSX. The `key={selectedClassId}` on the Tabs component will force a remount, resetting the active tab to "detail" (the `defaultValue`).

### Important Notes on Radix Tabs in jsdom

Radix UI tabs work in jsdom but tab panel visibility is CSS-driven via `data-state="active"` / `data-state="inactive"`. In jsdom, inactive tab panels are still in the DOM but have `data-state="inactive"`. When checking tab content visibility, query within the active tabpanel or check that the content node exists. The `TabsContent` component with `forceMount` is not used here, so only the active tab's content is rendered in the DOM by default (Radix unmounts inactive panels unless `forceMount` is set).

## File 2: Integration Test Verification

**File:** `frontend/src/features/ontology/components/OntologyBrowser.integration.test.tsx`

**Action:** Verify that existing tests pass without modification. No code changes are expected.

The integration test renders the `OntologyBrowser` component directly with mocked API calls and does not reference any route path. It tests component behavior (tree selection updates detail panel, ClassLink navigation, etc.) and is unaffected by the route change.

Run `cd /Users/vidarbrevik/projects/ontology-manager/frontend && pnpm vitest run OntologyBrowser.integration` to confirm all five existing tests pass.

## File 3: Playwright E2E Tests

**File:** `frontend/tests/ontology-browser.spec.ts`

**Action:** Update existing tests and add new test cases.

### Update: Route Path

In the `test.beforeEach` block, change the `page.goto` call:

```
// Before
await page.goto('/admin/ontology/browser');

// After
await page.goto('/ontology');
```

This is the only line that needs changing in the existing tests. All other selectors (`getByTestId('class-tree')`, `getByRole('treeitem')`, etc.) remain the same because the component structure is unchanged.

### New Test: Redirect from Old URL

Add a test inside the existing `test.describe('Ontology Browser')` block that verifies the redirect:

```
// Test: navigating to /admin/ontology/browser redirects to /ontology
```

Navigate to `/admin/ontology/browser` and then assert that `page.url()` ends with `/ontology`. Use `page.waitForURL('**/ontology')` to wait for the redirect to complete before asserting.

### New Test: Tab Triggers Visible After Class Selection

Add a test that selects a class from the tree and then verifies three tab triggers appear:

```
// Test: selecting a class shows three tab triggers in the detail panel
```

Click the first `treeitem`, then assert that `page.getByRole('tab')` has a count of 3. Optionally verify the tab names: "Detail", "Graph", "Relationships".

### New Test: Graph Tab Shows Placeholder

Add a test that selects a class, clicks the "Graph" tab, and verifies placeholder content appears:

```
// Test: clicking Graph tab shows placeholder content
```

Click a tree item to select a class, then click `page.getByRole('tab', { name: 'Graph' })`, and assert that text matching "graph visualization" (case-insensitive) is visible.

### New Test: Relationships Tab Shows Placeholder

Same pattern for the Relationships tab:

```
// Test: clicking Relationships tab shows placeholder content
```

Click a tree item, click the "Relationships" tab, and assert that text matching "relationship explorer" (case-insensitive) is visible.

## Execution Checklist

1. Add the six new unit tests to `frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx` (add `userEvent` import)
2. Run unit tests: `cd /Users/vidarbrevik/projects/ontology-manager/frontend && pnpm vitest run ClassDetail`
3. Verify integration tests pass: `cd /Users/vidarbrevik/projects/ontology-manager/frontend && pnpm vitest run OntologyBrowser.integration`
4. Update `page.goto` path in `frontend/tests/ontology-browser.spec.ts`
5. Add redirect test, tab triggers test, Graph tab test, and Relationships tab test to the E2E file
6. Run E2E tests: `cd /Users/vidarbrevik/projects/ontology-manager/frontend && pnpm exec playwright test ontology-browser.spec.ts`
7. Run full test suite to confirm no regressions: `cd /Users/vidarbrevik/projects/ontology-manager/frontend && pnpm vitest run`