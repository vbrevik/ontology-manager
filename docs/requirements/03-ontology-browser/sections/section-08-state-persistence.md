Now I have all the context needed. Here is the section content:

# Section 08: State Persistence

## Overview

This section adds localStorage persistence for the Ontology Browser's UI state: expanded tree nodes, selected class, source filter, and label mode. Panel sizes are handled automatically by `react-resizable-panels` via its built-in `autoSaveId` prop (already configured in section-03). This section focuses on the remaining persistence concerns that require custom implementation.

## Dependencies

- **section-03-layout-and-context**: Provides `OntologyBrowserContext` where `selectedClassId` and `labelMode` state live. This section adds localStorage read/write logic to that context.
- **section-04-tree-component**: Provides `useClassTree` hook and `ClassTreeSearch` component where expanded node state and source filter state live. This section adds localStorage read/write logic to those components.

## localStorage Keys

| Key | Value Type | Default | Owner Component |
|-----|-----------|---------|-----------------|
| `ontology-browser-layout` | Panel sizes (auto) | `[30, 70]` | PanelGroup `autoSaveId` (built-in, no custom code) |
| `ontology-browser-expanded` | JSON array of expanded node ID strings | `[]` | `useClassTree` hook |
| `ontology-browser-selected` | Class ID string or `null` | `null` | `OntologyBrowserContext` |
| `ontology-browser-source-filter` | Source ID string or `null` | `null` | `ClassTreeSearch` |
| `ontology-browser-label-mode` | `"name"` or `"description"` | `"name"` | `OntologyBrowserContext` |

## Tests

Write tests BEFORE implementation. All test files use Vitest + jsdom + @testing-library/react.

### State Persistence Tests (`frontend/src/features/ontology/components/statePersistence.test.ts`)

This test file covers the localStorage persistence behavior. It can be a standalone file testing the persistence utilities, or the tests can be added to the existing test files for `OntologyBrowserContext` and `useClassTree`. The recommended approach is a dedicated test file for persistence concerns.

**Tests to write:**

- Test: expanded node state is persisted to localStorage -- When `useClassTree` updates its expanded node set, the value under key `ontology-browser-expanded` in localStorage should be updated with a JSON-serialized array of the expanded node IDs. The write should be debounced (at least 300ms) to avoid excessive writes during rapid expand/collapse.

- Test: expanded node state is restored from localStorage on mount -- When `useClassTree` initializes, it should read `ontology-browser-expanded` from localStorage and use the parsed array as the initial set of expanded node IDs.

- Test: corrupt localStorage data falls back to defaults -- When localStorage contains invalid JSON for any persistence key (e.g., `ontology-browser-expanded` contains `"not valid json"`), the hook should catch the parse error and fall back to the default value (empty array for expanded, `null` for selected, `null` for source filter, `"name"` for label mode). No errors should propagate to the UI.

- Test: source filter state persists to localStorage -- When the source filter changes in `ClassTreeSearch`, the selected source ID (or `null` for "All Sources") should be written to localStorage under key `ontology-browser-source-filter`. On mount, the filter should be initialized from this stored value.

- Test: selected class ID persists to localStorage on change -- Already partially covered in section-03 (`OntologyBrowserContext` tests). Verify that calling `setSelectedClassId("some-id")` causes `localStorage.setItem` to be called with key `ontology-browser-selected` and value `"some-id"`.

- Test: selected class ID is restored from localStorage on mount -- Already partially covered in section-03. Verify that if `localStorage.getItem("ontology-browser-selected")` returns `"some-id"`, the context initializes with `selectedClassId === "some-id"`.

- Test: label mode persists to localStorage -- When `toggleLabelMode` is called, the new mode (`"name"` or `"description"`) should be written to `ontology-browser-label-mode`. On mount, it should be restored.

- Test: stale selected class is cleared -- If localStorage contains a `selectedClassId` that does not exist in the fetched class list, the context should reset `selectedClassId` to `null` and update localStorage accordingly. This prevents the detail panel from making 404 requests.

### Test Setup Notes

- Use `beforeEach` to clear localStorage: `localStorage.clear()`
- Mock localStorage using the jsdom environment's built-in `window.localStorage` (no need for a custom mock)
- For debounce testing, use `vi.useFakeTimers()` and `vi.advanceTimersByTime(300)` to verify debounced writes
- For hook testing, use `renderHook` from `@testing-library/react` with appropriate wrapper providers (QueryClientProvider, OntologyBrowserContext)

## Implementation Details

### Utility: `useLocalStorage` Hook

Create a small utility hook at `frontend/src/features/ontology/components/useLocalStorage.ts` that encapsulates the read/write/fallback pattern.

**Signature:**

```typescript
function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void]
```

**Behavior:**
- On initialization, read from `localStorage.getItem(key)`, parse with `JSON.parse`, and return the parsed value. If the key is missing or the JSON is invalid, return `defaultValue`.
- The setter calls `localStorage.setItem(key, JSON.stringify(value))` and updates React state.
- Wrap all `localStorage` access in try/catch to handle quota errors, private browsing restrictions, and corrupt data gracefully.

This hook is intentionally simple -- it does not handle debouncing. Debouncing is applied at the call site (expanded nodes) where write frequency is a concern.

### Modifications to `OntologyBrowserContext`

File: `frontend/src/features/ontology/components/OntologyBrowserContext.tsx`

The context provider (created in section-03) needs these persistence additions:

1. Initialize `selectedClassId` state using `useLocalStorage("ontology-browser-selected", null)` instead of plain `useState(null)`.
2. Initialize `labelMode` state using `useLocalStorage("ontology-browser-label-mode", "name")` instead of plain `useState("name")`.
3. The `setSelectedClassId` function should write through to localStorage via the `useLocalStorage` setter.
4. The `toggleLabelMode` function should write through to localStorage via the `useLocalStorage` setter.
5. Stale selection recovery: after the class list loads (from `useClassTree` or a separate query), check if the persisted `selectedClassId` exists in the list. If not, call `setSelectedClassId(null)`.

### Modifications to `useClassTree` Hook

File: `frontend/src/features/ontology/components/ClassTree/useClassTree.ts`

The hook (created in section-04) manages the set of expanded node IDs. Add persistence:

1. Initialize the expanded node set from localStorage: read `ontology-browser-expanded`, parse the JSON array, and construct a `Set<string>` from it.
2. When the expanded set changes (node expand or collapse), write the updated set to localStorage as a JSON array. **Debounce this write by 300ms** to avoid excessive writes during rapid keyboard navigation (holding down arrow keys while expanding).
3. Use `useRef` + `useEffect` with a timeout for the debounce, or use a small debounce utility. Clear the timeout on unmount.

### Modifications to `ClassTreeSearch`

File: `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx`

The search component (created in section-04) manages the source filter dropdown. Add persistence:

1. Initialize the source filter state from `useLocalStorage("ontology-browser-source-filter", null)`.
2. When the user selects a source from the dropdown (or selects "All Sources"), write the new value to localStorage via the setter.

### Corrupt Data Handling

All localStorage reads must be wrapped in try/catch:

```typescript
function readFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}
```

This pattern is encapsulated in the `useLocalStorage` hook. If localStorage is unavailable (e.g., in private browsing on some older browsers), the application should work normally with in-memory state only -- no errors should reach the user.

### Debounce for Expanded Nodes

The expanded node set can change rapidly during keyboard navigation. The debounce implementation should:

1. Use a `useRef` to hold a `setTimeout` ID.
2. On each change to the expanded set, clear the previous timeout and set a new one at 300ms.
3. When the timeout fires, serialize the set to a JSON array and write to localStorage.
4. On component unmount, clear the timeout and flush the current state to localStorage (so the last state is not lost).

Example pattern (not full implementation):

```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const persistExpanded = useCallback((expandedIds: Set<string>) => {
  if (timeoutRef.current) clearTimeout(timeoutRef.current)
  timeoutRef.current = setTimeout(() => {
    localStorage.setItem(
      'ontology-browser-expanded',
      JSON.stringify([...expandedIds])
    )
  }, 300)
}, [])
```

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/features/ontology/components/useLocalStorage.ts` | Reusable localStorage hook with JSON parse/stringify and error fallback |
| `frontend/src/features/ontology/components/statePersistence.test.ts` | Tests for all persistence behaviors |

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/features/ontology/components/OntologyBrowserContext.tsx` | Replace `useState` with `useLocalStorage` for `selectedClassId` and `labelMode`; add stale selection recovery |
| `frontend/src/features/ontology/components/ClassTree/useClassTree.ts` | Add localStorage init and debounced write for expanded node set |
| `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx` | Add `useLocalStorage` for source filter state |

## Implementation Checklist

1. Write all persistence tests in `statePersistence.test.ts`
2. Implement `useLocalStorage` hook
3. Update `OntologyBrowserContext` to use `useLocalStorage` for `selectedClassId` and `labelMode`
4. Add stale selection recovery logic to `OntologyBrowserContext`
5. Update `useClassTree` to read expanded nodes from localStorage on init
6. Add debounced localStorage write for expanded nodes in `useClassTree`
7. Update `ClassTreeSearch` to use `useLocalStorage` for source filter
8. Verify all tests pass with `cd /Users/vidarbrevik/projects/ontology-manager/frontend && pnpm vitest run`