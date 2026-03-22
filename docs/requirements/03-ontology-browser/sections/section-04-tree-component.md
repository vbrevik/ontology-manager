Good, the needed Shadcn components exist. Now I have everything needed to write the section.

# Section 04: Tree Component

## Overview

This section implements the three components that make up the left panel of the Ontology Browser: `ClassTree`, `ClassTreeNode`, and `ClassTreeSearch`. Together they provide a virtualized, keyboard-navigable, ARIA-compliant class hierarchy tree with search and source filtering.

**Depends on:**
- section-02-data-layer: `useClassTree` hook provides tree data in headless-tree format
- section-03-layout-and-context: `OntologyBrowserContext` provides `selectedClassId`, `setSelectedClassId`, `labelMode`
- section-06-shared-components: `SourceBadge` and `ConflictBadge` components for rendering badges on tree nodes

**Blocks:** section-07-inline-editing, section-08-state-persistence

---

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` | Tree container: search bar + headless tree + virtualizer |
| `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx` | Single tree node renderer |
| `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx` | Search input + source filter dropdown |
| `frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx` | Tests for ClassTree |
| `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.test.tsx` | Tests for ClassTreeNode |
| `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.test.tsx` | Tests for ClassTreeSearch |

---

## Tests (Write First)

Testing stack: Vitest 3.0.5 + jsdom + @testing-library/react + @testing-library/jest-dom. Test setup file at `frontend/src/test/setup.ts`.

### ClassTree.test.tsx

Location: `frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { ClassTree } from './ClassTree'

/**
 * Mock useClassTree to return controlled tree data.
 * Mock OntologyBrowserContext to capture setSelectedClassId calls.
 */

describe('ClassTree', () => {
  it('renders search bar and tree container')
  it('renders tree nodes from provided class data')
  it('clicking a node calls setSelectedClassId')
  it('selected node has bg-accent class')
  it('expand/collapse works on chevron click')
  it('keyboard Up/Down arrows navigate between nodes')
  it('keyboard Left/Right collapse/expand nodes')
  it('keyboard Enter selects focused node')
  it('Home/End keys jump to first/last node')
})
```

### ClassTreeNode.test.tsx

Location: `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
// import { ClassTreeNode } from './ClassTreeNode'

describe('ClassTreeNode', () => {
  it('renders class name')
  it('renders description when labelMode is "description"')
  it('indentation increases with tree depth level')
  it('shows chevron only when node has children')
  it('rotates chevron when node is expanded')
  it('renders SourceBadge when source_id present')
  it('does not render SourceBadge when source_id absent')
  it('renders conflict icon when conflict data present')
  it('does not render conflict icon when conflict data absent')
})
```

### ClassTreeSearch.test.tsx

Location: `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { ClassTreeSearch } from './ClassTreeSearch'

describe('ClassTreeSearch', () => {
  it('renders search input')
  it('typing in search input triggers onSearchChange (debounced 300ms)')
  it('renders source filter dropdown when classes have source_id')
  it('hides source filter dropdown when no classes have source_id')
  it('selecting a source filter triggers onSourceFilterChange')
})
```

---

## Implementation Details

### ClassTree Component

**File:** `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx`

This is the container component that wires together the search bar, headless tree, and virtualizer.

**Headless tree setup:**
- Use `buildProxiedInstance` from `@headless-tree/core` for lazy item creation (memory optimization for large trees)
- Enable features: `selectionFeature`, `hotkeysCoreFeature`, `syncDataLoaderFeature`
- Provide tree items from the `useClassTree` hook (section-02). The hook returns data in the format `{ rootItem: 'root', items: { root: { children: [...rootIds] }, [id]: { children: [...childIds], data: classData } } }`
- Connect selection to `OntologyBrowserContext.setSelectedClassId`

**Virtualization:**
- Use `useVirtualizer` from `@tanstack/react-virtual` with `estimateSize: () => 32` (32px per row)
- Container ref on a Shadcn `ScrollArea` component (already available at `@/components/ui/scroll-area`)
- Absolute positioning with `translateY` for virtual items
- Provide `scrollToItem` callback for keyboard navigation compatibility

**ARIA compliance:**
- The headless tree's `getContainerProps()` provides `role="tree"` and `aria-label`
- Each item's `getProps()` provides `role="treeitem"`, `aria-expanded`, `aria-selected`, `aria-level`, and `tabindex` (roving tabindex pattern)
- Keyboard shortcuts: Up/Down arrows navigate, Left/Right expand/collapse, Home/End jump to first/last, Enter selects, type-ahead search

**Component signature:**

```tsx
interface ClassTreeProps {
  /** Tree data from useClassTree hook */
  treeData: TreeData
  /** Search/filter state and handlers */
  searchText: string
  onSearchChange: (text: string) => void
  sourceFilter: string | null
  onSourceFilterChange: (sourceId: string | null) => void
  /** Available sources for the filter dropdown */
  availableSources: Array<{ id: string; name: string }>
}
```

**Layout structure:**
1. `ClassTreeSearch` at the top (search input + source filter + label toggle)
2. `ScrollArea` wrapping the virtualized tree list below

### ClassTreeNode Component

**File:** `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx`

Renders a single tree item row. Receives the headless-tree item and renders the visual representation.

**Layout (left to right):**
1. Indentation based on `item.getItemMeta().level` -- use `paddingLeft: level * 20` (pixels)
2. Expand/collapse chevron icon -- `ChevronRight` from `lucide-react`, rotated 90 degrees when expanded. Only shown on nodes that have children; otherwise render a transparent spacer of the same width to maintain alignment
3. Class name text (or description text if `labelMode` from context is `'description'`)
4. `SourceBadge` component (from section-06) -- only rendered if the class data has a `source_id` field
5. Conflict icon (`AlertTriangle` from `lucide-react` or `ConflictBadge` from section-06) -- only rendered if the class has conflict data

**Styling:**
- Selected node: `bg-accent` class
- Hover state: `hover:bg-muted`
- Use the `cn()` utility from `@/lib/utils` for conditional class composition
- Chevron: `transition-transform duration-200` for smooth rotation

**Component signature:**

```tsx
interface ClassTreeNodeProps {
  /** The headless-tree item instance */
  item: TreeItem<ClassNodeData>
  /** Whether this node is currently selected */
  isSelected: boolean
  /** Click handler for selection */
  onClick: () => void
}
```

Where `ClassNodeData` contains the class fields:

```tsx
interface ClassNodeData {
  id: string
  name: string
  description?: string
  source_id?: string
  parent_class_id?: string
  hasConflict?: boolean
}
```

### ClassTreeSearch Component

**File:** `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx`

Two controls in a horizontal layout:

1. **Search input** -- Shadcn `Input` component (from `@/components/ui/input`) with a search icon (`Search` from `lucide-react`). Apply 300ms debounce on the `onSearchChange` callback. The debounce prevents excessive re-filtering during rapid typing. Filters tree nodes by case-insensitive substring match on class name (not fuzzy search).

2. **Source filter dropdown** -- Shadcn `DropdownMenu` (from `@/components/ui/dropdown-menu`) with "All Sources" as the default entry, plus one entry per unique `source_id` found in the class list. Each entry shows the source badge color and name. Selecting a source filters the tree to only show classes from that source plus their ancestor path to maintain tree navigability. This entire dropdown is hidden if no classes have a `source_id` (graceful degradation for deployments without the import engine).

**Component signature:**

```tsx
interface ClassTreeSearchProps {
  searchText: string
  onSearchChange: (text: string) => void
  sourceFilter: string | null
  onSourceFilterChange: (sourceId: string | null) => void
  availableSources: Array<{ id: string; name: string }>
}
```

---

## Key Dependencies and Imports

The following packages are required (installed in section-01-infrastructure):
- `@headless-tree/core` -- `buildProxiedInstance`, `selectionFeature`, `hotkeysCoreFeature`, `syncDataLoaderFeature`
- `@headless-tree/react` -- React bindings for rendering tree items
- `@tanstack/react-virtual` -- `useVirtualizer`

Existing project dependencies used:
- `lucide-react` -- `ChevronRight`, `Search`, `AlertTriangle` icons
- `@/components/ui/scroll-area` -- `ScrollArea` component
- `@/components/ui/input` -- `Input` component
- `@/components/ui/dropdown-menu` -- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`
- `@/lib/utils` -- `cn()` utility for class name composition

Components from other sections (must be implemented or stubbed):
- `SourceBadge` from `@/features/ontology/components/shared/SourceBadge` (section-06)
- `ConflictBadge` from `@/features/ontology/components/shared/ConflictBadge` (section-06)
- `useClassTree` hook from `@/features/ontology/components/ClassTree/useClassTree` (section-02)
- `OntologyBrowserContext` from `@/features/ontology/components/OntologyBrowserContext` (section-03)

---

## API Data Shape Reference

The `Class` type from `@/features/ontology/lib/api` (the source data for tree nodes):

```typescript
interface Class {
  id: string
  name: string
  description?: string
  parent_class_id?: string
  version_id: string
  tenant_id?: string
  is_abstract: boolean
  attributes: Record<string, any>
  created_at: string
}
```

Note: `source_id` is not currently on the `Class` type. It will be present when the import engine (Split 01) is deployed. The tree node should check for `source_id` presence and conditionally render the `SourceBadge`. This is the "graceful degradation" pattern used throughout the browser.

---

## Integration Notes

- The `ClassTree` component is rendered inside the left panel of `OntologyBrowser` (section-03), wrapped in an error boundary
- Selection state flows through `OntologyBrowserContext`: when a tree node is clicked, `setSelectedClassId` is called, which updates both the context and the detail panel (section-05)
- The tree header area in the `OntologyBrowser` layout includes a "New Class" button (section-07), which is separate from the `ClassTree` component itself
- Expanded node state persistence to localStorage is handled in section-08; for this section, expanded state is managed in-memory only via the headless tree's built-in state management

---

## Implementation Notes (Post-Build)

### Deviations from plan
- **selectionFeature removed:** Code review identified split-brain between headless-tree's internal selection state and OntologyBrowserContext. Selection is managed entirely through context's `setSelectedClassId` via click handler, eliminating the conflict.
- **ClassTreeNode receives labelMode as prop** instead of reading from context — makes the component testable without context mock manipulation.
- **Source filter uses native `<select>` with `aria-label`** instead of Shadcn DropdownMenu — simpler implementation that passes ARIA compliance. Code review caught an incorrect `role="combobox"` that was removed.
- **@testing-library/user-event** installed as dev dependency for interaction testing.
- **Headless-tree and virtualizer mocked in unit tests** due to jsdom limitations — full keyboard navigation deferred to section-09 integration tests.

### Actual files created/modified
- `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` — full implementation with headless-tree + virtualizer
- `frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx` — 9 test cases
- `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx` — node renderer with chevron, badges
- `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.test.tsx` — 9 test cases
- `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx` — search input + source filter
- `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.test.tsx` — 5 test cases
- `frontend/src/features/ontology/components/shared/SourceBadge.tsx` — updated stub with sourceId prop

### Test count
23 tests (9 ClassTree + 9 ClassTreeNode + 5 ClassTreeSearch), all passing