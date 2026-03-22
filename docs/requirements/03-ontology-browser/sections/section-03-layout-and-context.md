Now I have all the context needed. Let me produce the section content.

# Section 03: Layout and Context

## Overview

This section implements the `OntologyBrowser` layout component and the `OntologyBrowserContext` that provides shared state across the browser. The layout uses `react-resizable-panels` (already installed, with Shadcn wrappers at `@/components/ui/resizable`) to create a resizable split-panel view. The context manages selected class ID, label mode, and stale selection recovery.

**Dependencies:** Sections 01 (infrastructure/route) and 02 (data layer hooks) must be complete before this section.

**Blocks:** Sections 04 (tree component), 05 (detail panel), 07 (inline editing), and 08 (state persistence) depend on this section.

---

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/features/ontology/components/OntologyBrowserContext.tsx` | React Context for shared browser state |
| `frontend/src/features/ontology/components/OntologyBrowser.tsx` | Main layout with resizable panels and error boundaries |
| `frontend/src/features/ontology/components/OntologyBrowserContext.test.tsx` | Tests for context |
| `frontend/src/features/ontology/components/OntologyBrowser.test.tsx` | Tests for layout |

---

## Tests (Write First)

### OntologyBrowserContext Tests

**File:** `frontend/src/features/ontology/components/OntologyBrowserContext.test.tsx`

**Testing stack:** Vitest + @testing-library/react + @testing-library/jest-dom

Write a test wrapper component that consumes the context and exposes values for assertions. Use `renderHook` or a small consumer component to test the context provider.

Tests to implement:

- **initializes selectedClassId from localStorage if present** -- Set `localStorage.setItem('ontology-browser-selected', '"some-id"')` before rendering. Assert `selectedClassId` equals `"some-id"`.
- **defaults selectedClassId to null if localStorage empty** -- Clear localStorage before rendering. Assert `selectedClassId` is `null`.
- **persists selectedClassId to localStorage on change** -- Render context, call `setSelectedClassId("new-id")`. Assert `localStorage.getItem('ontology-browser-selected')` contains `"new-id"`.
- **clears selectedClassId to null when class not found in class list (stale recovery)** -- The context accepts a `classList` prop (or reads from the useClassTree hook result). If the persisted ID is not in the class list, it should reset to `null`. Set localStorage to a class ID that does not exist in the provided class list, render, assert `selectedClassId` becomes `null`.
- **provides labelMode and toggleLabelMode** -- Render context, assert `labelMode` defaults to `'name'`. Call `toggleLabelMode()`, assert it changes to `'description'`. Call again, assert it toggles back to `'name'`.

Key details for the test file:
- Clear `localStorage` in a `beforeEach` to isolate tests.
- The context provider needs to be importable as `OntologyBrowserProvider` from `OntologyBrowserContext.tsx`.
- Use a `useContext` consumer helper or `renderHook` with the provider wrapper.

### OntologyBrowser Tests

**File:** `frontend/src/features/ontology/components/OntologyBrowser.test.tsx`

Tests to implement:

- **renders PanelGroup with two panels** -- Render `OntologyBrowser`. Assert that two panel regions are present (use data attributes or test IDs such as `data-testid="tree-panel"` and `data-testid="detail-panel"`).
- **left panel contains ClassTree** -- Assert the tree panel region contains the `ClassTree` component (mock `ClassTree` to render a known test ID or text).
- **right panel contains ClassDetail** -- Assert the detail panel region contains the `ClassDetail` component (mock `ClassDetail` similarly).
- **wraps children in OntologyBrowserContext provider** -- Render `OntologyBrowser`. Assert that `ClassTree` and `ClassDetail` (mocked) can access the context values (e.g., `selectedClassId` is available).
- **error boundary in tree panel catches errors without crashing detail panel** -- Mock `ClassTree` to throw an error. Assert the tree panel shows an error fallback (e.g., "Something went wrong") while the detail panel still renders normally.
- **error boundary in detail panel catches errors without crashing tree panel** -- Mock `ClassDetail` to throw an error. Assert the detail panel shows an error fallback while the tree panel still renders normally.

Key details for the test file:
- Mock the `ClassTree` and `ClassDetail` components using `vi.mock()` since they are implemented in later sections (04 and 05). The mocks should render simple divs with test IDs.
- For error boundary tests, create a mock component that conditionally throws.
- Wrap renders in a `QueryClientProvider` with a fresh `QueryClient` for isolation.

---

## Implementation Details

### OntologyBrowserContext

**File:** `frontend/src/features/ontology/components/OntologyBrowserContext.tsx`

Create a React Context with the following interface:

```typescript
interface OntologyBrowserContextValue {
  selectedClassId: string | null
  setSelectedClassId: (id: string | null) => void
  labelMode: 'name' | 'description'
  toggleLabelMode: () => void
}
```

**Provider component (`OntologyBrowserProvider`):**

- Accept an optional `classList` prop (array of class objects with `id` field) for stale selection recovery.
- Initialize `selectedClassId` from `localStorage.getItem('ontology-browser-selected')`. Parse the JSON string. If parsing fails or value is missing, default to `null`.
- Initialize `labelMode` from `localStorage.getItem('ontology-browser-label-mode')`. Default to `'name'`.
- On `selectedClassId` change, write to localStorage via `useEffect`.
- On `labelMode` change, write to localStorage via `useEffect`.
- **Stale selection recovery:** Use a `useEffect` that runs when `classList` changes. If `selectedClassId` is non-null and `classList` is loaded (non-empty array), check if any class in the list has `id === selectedClassId`. If not found, call `setSelectedClassId(null)`. This prevents the detail panel from trying to fetch a deleted class.
- Export a `useOntologyBrowser()` hook that calls `useContext` and throws if used outside the provider.

**localStorage keys used:**
- `ontology-browser-selected` -- stores the selected class ID as a JSON string
- `ontology-browser-label-mode` -- stores `'name'` or `'description'`

### OntologyBrowser Layout

**File:** `frontend/src/features/ontology/components/OntologyBrowser.tsx`

This is the main layout component rendered by the route at `src/routes/admin/ontology/browser.tsx`.

**Structure:**

```
OntologyBrowserProvider
  └── ResizablePanelGroup (direction="horizontal", autoSaveId="ontology-browser-layout")
       ├── ResizablePanel (left, tree)
       │    └── ErrorBoundary
       │         └── ClassTree
       ├── ResizableHandle (withHandle, includes collapse toggle button)
       └── ResizablePanel (right, detail)
            └── ErrorBoundary
                 └── ClassDetail
```

**Left panel configuration:**
- `defaultSize={30}` (percentage of total width)
- `minSize={15}`
- `maxSize={50}`
- `collapsible={true}`
- `collapsedSize={0}`
- `data-testid="tree-panel"`

**Right panel configuration:**
- `defaultSize={70}`
- `data-testid="detail-panel"`

**Panel persistence:** The `autoSaveId="ontology-browser-layout"` prop on `ResizablePanelGroup` automatically persists and restores panel sizes to/from localStorage. This is built into `react-resizable-panels` and requires no additional code.

**Collapse toggle:** Add a button inside or adjacent to the `ResizableHandle` that toggles the left panel between collapsed (0%) and its previous size. Use a ref to the left panel (`React.useRef<ImperativePanelHandle>(null)`) and call `panel.collapse()` / `panel.expand()` on click. Display a `ChevronLeft`/`ChevronRight` icon from Lucide to indicate direction.

**Use the existing Shadcn resizable wrappers** from `@/components/ui/resizable`:
- `ResizablePanelGroup` (wraps `PanelGroup`)
- `ResizablePanel` (wraps `Panel`)
- `ResizableHandle` (wraps `PanelResizeHandle`)

### Error Boundary

Since no error boundary component exists in the codebase yet, create a simple class-based error boundary inline in the `OntologyBrowser.tsx` file (or as a small separate component). It should:

- Catch rendering errors in its children
- Display a fallback UI: a centered message "Something went wrong" with a "Try again" button that calls `this.setState({ hasError: false })` to attempt re-render
- Not affect sibling components (each panel has its own independent error boundary)

The error boundary is a standard React class component:

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}
```

Implement `static getDerivedStateFromError()` and `componentDidCatch()`. The retry button resets `hasError` to `false`.

### Connecting the Context to Data

The `OntologyBrowser` component should:
1. Call the `useClassTree` hook (from section 02) to get the class list
2. Pass the class list to `OntologyBrowserProvider` for stale selection recovery
3. The provider makes `selectedClassId` available to both `ClassTree` (for highlighting) and `ClassDetail` (for fetching details)

Until section 02 is implemented, `useClassTree` can be stubbed to return an empty array. The layout and context should function independently of the data layer.

### Stubbed Child Components

During this section's implementation, `ClassTree` and `ClassDetail` do not exist yet (they come from sections 04 and 05). Create minimal placeholder components:

- `ClassTree` -- renders a div with text "Class tree loading..." and `data-testid="class-tree"`
- `ClassDetail` -- renders a div with text "Select a class to view details" and `data-testid="class-detail"`

These will be replaced with full implementations in sections 04 and 05.

---

## Summary Checklist

1. Write `OntologyBrowserContext.test.tsx` with all five test cases
2. Write `OntologyBrowser.test.tsx` with all six test cases
3. Implement `OntologyBrowserContext.tsx` with provider, context, hook, localStorage persistence, and stale recovery
4. Implement `OntologyBrowser.tsx` with resizable panels, error boundaries, collapse toggle, and context provider wiring
5. Create placeholder `ClassTree` and `ClassDetail` stubs (to be replaced in sections 04/05)
6. Verify all tests pass with `cd /Users/vidarbrevik/projects/ontology-manager/frontend && pnpm vitest run`

---

## Implementation Notes (Post-Build)

### Deviations from plan
- **Shadcn resizable wrapper updated for v4 API:** `react-resizable-panels@4.7.4` exports `Group`, `Panel`, `Separator` instead of the older `PanelGroup`, `Panel`, `PanelResizeHandle`. The wrapper at `@/components/ui/resizable.tsx` was updated accordingly. `direction` prop renamed to `orientation`, `autoSaveId` replaced by `useDefaultLayout` hook (deferred to section 08).
- **Panel ref uses `panelRef` prop** instead of `ref` — v4 API change. `PanelImperativeHandle` replaces `ImperativePanelHandle`.
- **Collapse toggle button moved outside ResizableHandle** — code review identified ARIA violation (interactive button inside `role="separator"`). Button now overlays the tree panel edge with absolute positioning.
- **Stale recovery effect optimized with ref** — `selectedClassId` read from ref instead of deps array to avoid O(n) classList scan on every selection change.
- **Toast double-dismiss timer removed** — `ToastProvider.toast()` had a redundant setTimeout that raced with ToastItem's own dismiss lifecycle, preventing exit animations.

### Actual files created/modified
- `frontend/src/features/ontology/components/OntologyBrowserContext.tsx` — full provider with localStorage persistence and stale recovery
- `frontend/src/features/ontology/components/OntologyBrowserContext.test.tsx` — 5 test cases
- `frontend/src/features/ontology/components/OntologyBrowser.tsx` — layout with error boundaries and collapse toggle
- `frontend/src/features/ontology/components/OntologyBrowser.test.tsx` — 6 test cases (panels mocked for jsdom)
- `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` — updated stub with data-testid
- `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx` — updated stub with data-testid
- `frontend/src/routes/admin/ontology/browser.tsx` — wired OntologyBrowser component
- `frontend/src/components/ui/resizable.tsx` — updated for react-resizable-panels v4 API
- `frontend/src/components/ui/toast.tsx` — removed double-dismiss timer

### Test count
11 tests (5 context + 6 layout), all passing