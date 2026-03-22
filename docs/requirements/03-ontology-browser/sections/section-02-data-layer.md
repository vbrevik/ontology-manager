Now I have all the context needed. Let me generate the section content.

# Section 02: Data Layer

## Overview

This section implements the data-fetching and tree-building layer for the Ontology Browser. It consists of three units:

1. **`buildClassTree`** -- a pure function that converts a flat array of classes into the hierarchical format expected by `@headless-tree/core`
2. **`useClassTree`** -- a React hook that fetches classes via TanStack Query, builds the tree, and manages search/filter state
3. **`useClassDetail`** -- a React hook that fetches class detail, properties, and current version for the selected class

All data fetching reuses the existing API functions in `@/features/ontology/lib/api` (`fetchClasses`, `getClass`, `fetchProperties`, `fetchCurrentVersion`, `updateClass`, `createProperty`, `updateProperty`, `deleteProperty`).

## Dependencies

- **section-01-infrastructure** must be completed first (dependencies installed, directory structure created)
- The existing API module at `frontend/src/features/ontology/lib/api.ts` provides all network functions and TypeScript interfaces (`Class`, `Property`, `OntologyVersion`, `CreatePropertyInput`, `UpdatePropertyInput`, `UpdateClassInput`)

## Files to Create

```
frontend/src/features/ontology/components/ClassTree/buildClassTree.ts
frontend/src/features/ontology/components/ClassTree/buildClassTree.test.ts
frontend/src/features/ontology/components/ClassTree/useClassTree.ts
frontend/src/features/ontology/components/ClassTree/useClassTree.test.ts
frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
frontend/src/features/ontology/components/ClassDetail/useClassDetail.test.ts
```

---

## Tests First

### buildClassTree.test.ts

**File:** `frontend/src/features/ontology/components/ClassTree/buildClassTree.test.ts`

This tests the pure tree-building function. No mocking or providers needed -- pure input/output tests.

```ts
import { describe, it, expect } from 'vitest'
import { buildClassTree } from './buildClassTree'

// Helper to create a minimal class object for testing
function makeClass(overrides: { id: string; name: string; parent_class_id?: string | null; source_id?: string }) {
  return {
    id: overrides.id,
    name: overrides.name,
    parent_class_id: overrides.parent_class_id ?? null,
    source_id: overrides.source_id,
    description: '',
    version_id: 'v1',
    is_abstract: false,
    attributes: {},
    created_at: '2024-01-01T00:00:00Z',
  }
}

describe('buildClassTree', () => {
  it('builds correct Map from flat array')
  it('groups children by parent_class_id')
  it('handles single root node')
  it('handles multiple root nodes')
  it('handles deeply nested hierarchy (3+ levels)')
  it('handles class with no children (leaf node)')
  it('returns empty tree structure when class list is empty')
  it('root nodes are those with parent_class_id === null')
  it('orphaned nodes (parent_class_id references non-existent parent) become root nodes')
  it('children are sorted alphabetically by name at each level')
  it('converts to headless-tree format with rootItem, items record, and children arrays')
})
```

Each test should call `buildClassTree(classes)` with a crafted array and assert the shape of the returned object. The `makeClass` helper above provides the minimal `Class` shape required.

### useClassTree.test.ts

**File:** `frontend/src/features/ontology/components/ClassTree/useClassTree.test.ts`

This tests the hook using `renderHook` from `@testing-library/react` wrapped in a `QueryClientProvider`. Mock `fetchClasses` at the module level.

```ts
import { describe, it, vi } from 'vitest'

// Mock the API module before imports
vi.mock('@/features/ontology/lib/api', () => ({
  fetchClasses: vi.fn(),
}))

describe('useClassTree', () => {
  // Each test should:
  // 1. Set up fetchClasses mock return value
  // 2. renderHook(() => useClassTree(), { wrapper: createQueryWrapper() })
  // 3. waitFor the query to settle
  // 4. Assert on result.current

  it('returns empty tree structure when class list is empty')
  it('builds correct parent-child hierarchy from flat class list')
  it('root nodes are those with parent_class_id === null')
  it('orphaned nodes (parent_class_id references non-existent parent) become root nodes')
  it('children are sorted alphabetically by name at each level')
  it('converts to headless-tree format with rootItem, items record, and children arrays')
  it('text filter returns only nodes matching case-insensitive substring on class name')
  it('text filter includes ancestor path of matching nodes (preserves tree navigability)')
  it('source filter returns only classes with matching source_id plus ancestors')
  it('source filter is no-op when no classes have source_id')
  it('combined text + source filter applies both conditions')
})
```

A test wrapper factory is needed to provide `QueryClientProvider`:

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}
```

### useClassDetail.test.ts

**File:** `frontend/src/features/ontology/components/ClassDetail/useClassDetail.test.ts`

```ts
import { describe, it, vi } from 'vitest'

vi.mock('@/features/ontology/lib/api', () => ({
  getClass: vi.fn(),
  fetchProperties: vi.fn(),
  fetchCurrentVersion: vi.fn(),
}))

describe('useClassDetail', () => {
  it('fetches class detail, properties, and current version when classId provided')
  it('does not fetch when classId is null (queries disabled)')
  it('provides mutation function for description update')
  it('provides mutation function for property CRUD with version_id')
  it('handles API errors gracefully (returns error state, does not throw)')
})
```

---

## Implementation Details

### Query Key Strategy

Define a consistent query key factory. This can live in `useClassTree.ts` or a shared constants file:

```
['classes', 'list']                    -- Flat class list for tree building
['classes', 'detail', classId]         -- Full class data
['classes', classId, 'properties']     -- Properties for selected class
['ontology-versions', 'current']       -- Current version (needed for property creation)
```

### buildClassTree Pure Function

**File:** `frontend/src/features/ontology/components/ClassTree/buildClassTree.ts`

This is a pure function with no React dependencies. It accepts the `Class[]` array (from the API) and returns the data structure that `@headless-tree/core` expects.

**Signature:**

```ts
import type { Class } from '@/features/ontology/lib/api'

export interface TreeItem {
  children: string[]
  data?: Class
}

export interface ClassTreeData {
  rootItem: string
  items: Record<string, TreeItem>
}

export function buildClassTree(classes: Class[]): ClassTreeData
```

**Algorithm:**

1. Create a `Map<string, Class>` for O(1) lookup by `id`.
2. Create a `Map<string, string[]>` grouping child IDs by `parent_class_id`.
3. Identify root nodes: classes where `parent_class_id` is `null`, `undefined`, or references an ID not present in the class map (orphan recovery).
4. Sort children arrays alphabetically by class name at every level.
5. Build the output `items` record. The special `'root'` key has `children` set to the sorted root node IDs. Each class ID key has `children` from the children map (defaulting to `[]`) and `data` set to the class object.
6. Return `{ rootItem: 'root', items }`.

### useClassTree Hook

**File:** `frontend/src/features/ontology/components/ClassTree/useClassTree.ts`

**Signature:**

```ts
export interface UseClassTreeReturn {
  treeData: ClassTreeData | undefined
  isLoading: boolean
  error: Error | null
  searchText: string
  setSearchText: (text: string) => void
  sourceFilter: string | null
  setSourceFilter: (sourceId: string | null) => void
  availableSources: string[]
}

export function useClassTree(): UseClassTreeReturn
```

**Responsibilities:**

1. **Fetch classes** using `useQuery` with key `['classes', 'list']` and `queryFn: fetchClasses`. Use `staleTime: 5 * 60 * 1000` (5 minutes) since the class list changes infrequently.
2. **Build tree** by calling `buildClassTree(data)` in a `useMemo` when data is available.
3. **Search filter state** -- `useState` for `searchText` (string) and `sourceFilter` (string | null).
4. **Apply filters** in a second `useMemo` that takes the full tree and filters. When filters are active:
   - Identify matching node IDs (case-insensitive substring on `name` for text filter, exact match on `source_id` for source filter).
   - Collect ancestor paths for all matching nodes (walk up `parent_class_id` chain using the class map).
   - Rebuild the tree items to include only matching nodes and their ancestors, preserving `children` arrays (filtered to only include visible children).
5. **Extract available sources** -- `useMemo` that collects unique `source_id` values from the class list (filtering out undefined/null). This list drives the source filter dropdown visibility.

**Filter algorithm detail:** When both text and source filters are active, a node is "matching" only if it satisfies both conditions (AND logic). Ancestor inclusion is computed after the AND filter -- ancestors of matching nodes are included regardless of whether they themselves match the filters.

### useClassDetail Hook

**File:** `frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts`

**Signature:**

```ts
import type { Class, Property, OntologyVersion } from '@/features/ontology/lib/api'

export interface UseClassDetailReturn {
  classData: Class | undefined
  properties: Property[] | undefined
  currentVersion: OntologyVersion | undefined
  isLoading: boolean
  isPlaceholderData: boolean
  error: Error | null
  updateDescription: (description: string) => Promise<void>
  createProperty: (input: Omit<CreatePropertyInput, 'class_id' | 'version_id'>) => Promise<void>
  updateProperty: (id: string, input: UpdatePropertyInput) => Promise<void>
  deleteProperty: (id: string) => Promise<void>
}

export function useClassDetail(classId: string | null): UseClassDetailReturn
```

**Responsibilities:**

1. **Three parallel queries**, all with `enabled: !!classId`:
   - Class detail: `useQuery({ queryKey: ['classes', 'detail', classId], queryFn: () => getClass(classId!), placeholderData: keepPreviousData })`
   - Properties: `useQuery({ queryKey: ['classes', classId, 'properties'], queryFn: () => fetchProperties(classId!), placeholderData: keepPreviousData })`
   - Current version: `useQuery({ queryKey: ['ontology-versions', 'current'], queryFn: fetchCurrentVersion, staleTime: Infinity })` (version rarely changes during a session)
2. **Mutation functions** (these are exposed for use by section-07-inline-editing but the mutation wrappers are defined here):
   - `updateDescription` -- calls `updateClass(classId, { description })`, invalidates relevant queries
   - `createProperty` -- calls API `createProperty` with `class_id` and `version_id` injected from hook state
   - `updateProperty` -- calls API `updateProperty`, invalidates property query
   - `deleteProperty` -- calls API `deleteProperty`, invalidates property query
3. **Aggregate loading state**: `isLoading` is true if any of the three queries are in initial loading state. `isPlaceholderData` is true if any query is showing placeholder (cached) data while refetching.
4. **Error aggregation**: return the first non-null error from the three queries.

The mutation functions should use `useMutation` from TanStack Query. Optimistic update logic (cache manipulation in `onMutate`, rollback in `onError`) will be fully wired in section-07-inline-editing, but the basic mutation setup with `onSettled` invalidation belongs here.

---

## Key API Types Reference

These types are already defined in `frontend/src/features/ontology/lib/api.ts` and should be imported, not redefined:

- **`Class`** -- `{ id, name, description?, parent_class_id?, version_id, is_abstract, attributes, created_at }`
- **`Property`** -- `{ id, name, description?, class_id, data_type, is_required, is_unique, version_id, validation_rules }`
- **`OntologyVersion`** -- `{ id, version, description?, is_current, created_at }`
- **`CreatePropertyInput`** -- `{ name, description?, class_id, data_type, is_required?, is_unique?, version_id, validation_rules? }`
- **`UpdatePropertyInput`** -- `{ description?, data_type?, is_required?, is_unique?, validation_rules? }`
- **`UpdateClassInput`** -- `{ description?, parent_class_id?, is_abstract? }`

Note: The `Class` type does not currently have a `source_id` field. The source badge and source filter features are designed for graceful degradation -- they only activate when `source_id` is present. The `buildClassTree` and filter logic should treat `source_id` as an optional field on the class data (accessed via `(cls as any).source_id` or by extending the type locally with an intersection type).

## Testing Utilities

The test setup file exists at `frontend/src/test/setup.ts`. Tests use Vitest 3.0.5 with jsdom environment and `@testing-library/react`. For hook tests, use `renderHook` and `waitFor` from `@testing-library/react`. Wrap hooks in a `QueryClientProvider` with retry disabled to avoid flaky async behavior in tests.