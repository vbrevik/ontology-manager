diff --git a/frontend/src/features/ontology/components/ClassDetail/useClassDetail.test.tsx b/frontend/src/features/ontology/components/ClassDetail/useClassDetail.test.tsx
new file mode 100644
index 0000000..0158574
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/useClassDetail.test.tsx
@@ -0,0 +1,153 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { renderHook, waitFor } from '@testing-library/react'
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
+import type { ReactNode } from 'react'
+
+vi.mock('@/features/ontology/lib/api', () => ({
+  getClass: vi.fn(),
+  fetchProperties: vi.fn(),
+  fetchCurrentVersion: vi.fn(),
+  updateClass: vi.fn(),
+  createProperty: vi.fn(),
+  updateProperty: vi.fn(),
+  deleteProperty: vi.fn(),
+}))
+
+import {
+  getClass,
+  fetchProperties,
+  fetchCurrentVersion,
+} from '@/features/ontology/lib/api'
+import { useClassDetail } from './useClassDetail'
+
+const mockedGetClass = vi.mocked(getClass)
+const mockedFetchProperties = vi.mocked(fetchProperties)
+const mockedFetchCurrentVersion = vi.mocked(fetchCurrentVersion)
+
+function createWrapper() {
+  const queryClient = new QueryClient({
+    defaultOptions: { queries: { retry: false } },
+  })
+  return function Wrapper({ children }: { children: ReactNode }) {
+    return (
+      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
+    )
+  }
+}
+
+beforeEach(() => {
+  vi.clearAllMocks()
+  mockedFetchCurrentVersion.mockResolvedValue({
+    id: 'ver-1',
+    version: '1.0',
+    is_current: true,
+    created_at: '2024-01-01T00:00:00Z',
+  })
+})
+
+describe('useClassDetail', () => {
+  it('fetches class detail, properties, and current version when classId provided', async () => {
+    mockedGetClass.mockResolvedValue({
+      id: 'cls-1',
+      name: 'Vehicle',
+      description: 'A vehicle',
+      version_id: 'v1',
+      is_abstract: false,
+      attributes: {},
+      created_at: '2024-01-01T00:00:00Z',
+    })
+    mockedFetchProperties.mockResolvedValue([
+      {
+        id: 'prop-1',
+        name: 'speed',
+        class_id: 'cls-1',
+        data_type: 'integer',
+        is_required: false,
+        is_unique: false,
+        version_id: 'v1',
+        validation_rules: null,
+      },
+    ])
+
+    const { result } = renderHook(() => useClassDetail('cls-1'), {
+      wrapper: createWrapper(),
+    })
+
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+
+    expect(result.current.classData?.name).toBe('Vehicle')
+    expect(result.current.properties).toHaveLength(1)
+    expect(result.current.currentVersion?.id).toBe('ver-1')
+    expect(mockedGetClass).toHaveBeenCalledWith('cls-1')
+    expect(mockedFetchProperties).toHaveBeenCalledWith('cls-1')
+  })
+
+  it('does not fetch when classId is null (queries disabled)', async () => {
+    const { result } = renderHook(() => useClassDetail(null), {
+      wrapper: createWrapper(),
+    })
+
+    // Give time for any async operations
+    await new Promise((r) => setTimeout(r, 50))
+
+    expect(mockedGetClass).not.toHaveBeenCalled()
+    expect(mockedFetchProperties).not.toHaveBeenCalled()
+    expect(result.current.classData).toBeUndefined()
+    expect(result.current.properties).toBeUndefined()
+  })
+
+  it('provides mutation function for description update', async () => {
+    mockedGetClass.mockResolvedValue({
+      id: 'cls-1',
+      name: 'Vehicle',
+      version_id: 'v1',
+      is_abstract: false,
+      attributes: {},
+      created_at: '2024-01-01T00:00:00Z',
+    })
+    mockedFetchProperties.mockResolvedValue([])
+
+    const { result } = renderHook(() => useClassDetail('cls-1'), {
+      wrapper: createWrapper(),
+    })
+
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+
+    expect(typeof result.current.updateDescription).toBe('function')
+  })
+
+  it('provides mutation functions for property CRUD', async () => {
+    mockedGetClass.mockResolvedValue({
+      id: 'cls-1',
+      name: 'Vehicle',
+      version_id: 'v1',
+      is_abstract: false,
+      attributes: {},
+      created_at: '2024-01-01T00:00:00Z',
+    })
+    mockedFetchProperties.mockResolvedValue([])
+
+    const { result } = renderHook(() => useClassDetail('cls-1'), {
+      wrapper: createWrapper(),
+    })
+
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+
+    expect(typeof result.current.createProperty).toBe('function')
+    expect(typeof result.current.updateProperty).toBe('function')
+    expect(typeof result.current.deleteProperty).toBe('function')
+  })
+
+  it('handles API errors gracefully (returns error state)', async () => {
+    mockedGetClass.mockRejectedValue(new Error('Network error'))
+    mockedFetchProperties.mockResolvedValue([])
+
+    const { result } = renderHook(() => useClassDetail('cls-1'), {
+      wrapper: createWrapper(),
+    })
+
+    await waitFor(() => expect(result.current.error).not.toBeNull())
+
+    expect(result.current.error?.message).toBe('Network error')
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts b/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
index 04e04c3..e940483 100644
--- a/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
+++ b/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
@@ -1,5 +1,132 @@
-/** Hook: fetch class detail, properties, current version for selected class */
-export function useClassDetail(_classId: string | null) {
-  // Implemented in Section 02
-  return { classData: null, properties: [], isLoading: true }
+import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
+import {
+  getClass,
+  fetchProperties,
+  fetchCurrentVersion,
+  updateClass,
+  createProperty as apiCreateProperty,
+  updateProperty as apiUpdateProperty,
+  deleteProperty as apiDeleteProperty,
+} from '@/features/ontology/lib/api'
+import type {
+  Class,
+  Property,
+  OntologyVersion,
+  CreatePropertyInput,
+  UpdatePropertyInput,
+} from '@/features/ontology/lib/api'
+
+export interface UseClassDetailReturn {
+  classData: Class | undefined
+  properties: Property[] | undefined
+  currentVersion: OntologyVersion | undefined
+  isLoading: boolean
+  isPlaceholderData: boolean
+  error: Error | null
+  updateDescription: (description: string) => Promise<void>
+  createProperty: (
+    input: Omit<CreatePropertyInput, 'class_id' | 'version_id'>,
+  ) => Promise<void>
+  updateProperty: (id: string, input: UpdatePropertyInput) => Promise<void>
+  deleteProperty: (id: string) => Promise<void>
+}
+
+export function useClassDetail(classId: string | null): UseClassDetailReturn {
+  const queryClient = useQueryClient()
+
+  const classQuery = useQuery({
+    queryKey: ['classes', 'detail', classId],
+    queryFn: () => getClass(classId!),
+    enabled: !!classId,
+    placeholderData: keepPreviousData,
+  })
+
+  const propertiesQuery = useQuery({
+    queryKey: ['classes', classId, 'properties'],
+    queryFn: () => fetchProperties(classId!),
+    enabled: !!classId,
+    placeholderData: keepPreviousData,
+  })
+
+  const versionQuery = useQuery({
+    queryKey: ['ontology-versions', 'current'],
+    queryFn: fetchCurrentVersion,
+    staleTime: Infinity,
+  })
+
+  const descriptionMutation = useMutation({
+    mutationFn: (description: string) =>
+      updateClass(classId!, { description }),
+    onSettled: () => {
+      queryClient.invalidateQueries({ queryKey: ['classes', 'list'] })
+      queryClient.invalidateQueries({
+        queryKey: ['classes', 'detail', classId],
+      })
+    },
+  })
+
+  const createPropertyMutation = useMutation({
+    mutationFn: (input: Omit<CreatePropertyInput, 'class_id' | 'version_id'>) =>
+      apiCreateProperty({
+        ...input,
+        class_id: classId!,
+        version_id: versionQuery.data?.id ?? '',
+      }),
+    onSettled: () => {
+      queryClient.invalidateQueries({
+        queryKey: ['classes', classId, 'properties'],
+      })
+    },
+  })
+
+  const updatePropertyMutation = useMutation({
+    mutationFn: ({ id, input }: { id: string; input: UpdatePropertyInput }) =>
+      apiUpdateProperty(id, input),
+    onSettled: () => {
+      queryClient.invalidateQueries({
+        queryKey: ['classes', classId, 'properties'],
+      })
+    },
+  })
+
+  const deletePropertyMutation = useMutation({
+    mutationFn: (id: string) => apiDeleteProperty(id),
+    onSettled: () => {
+      queryClient.invalidateQueries({
+        queryKey: ['classes', classId, 'properties'],
+      })
+    },
+  })
+
+  const isLoading =
+    classQuery.isLoading || propertiesQuery.isLoading || versionQuery.isLoading
+  const isPlaceholderData =
+    classQuery.isPlaceholderData || propertiesQuery.isPlaceholderData
+  const error =
+    (classQuery.error as Error | null) ??
+    (propertiesQuery.error as Error | null) ??
+    (versionQuery.error as Error | null)
+
+  return {
+    classData: classQuery.data,
+    properties: propertiesQuery.data,
+    currentVersion: versionQuery.data,
+    isLoading,
+    isPlaceholderData,
+    error,
+    updateDescription: async (description: string) => {
+      await descriptionMutation.mutateAsync(description)
+    },
+    createProperty: async (
+      input: Omit<CreatePropertyInput, 'class_id' | 'version_id'>,
+    ) => {
+      await createPropertyMutation.mutateAsync(input)
+    },
+    updateProperty: async (id: string, input: UpdatePropertyInput) => {
+      await updatePropertyMutation.mutateAsync({ id, input })
+    },
+    deleteProperty: async (id: string) => {
+      await deletePropertyMutation.mutateAsync(id)
+    },
+  }
 }
diff --git a/frontend/src/features/ontology/components/ClassTree/buildClassTree.test.ts b/frontend/src/features/ontology/components/ClassTree/buildClassTree.test.ts
new file mode 100644
index 0000000..8d7dec2
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/buildClassTree.test.ts
@@ -0,0 +1,121 @@
+import { describe, it, expect } from 'vitest'
+import { buildClassTree } from './buildClassTree'
+import type { Class } from '@/features/ontology/lib/api'
+
+function makeClass(overrides: {
+  id: string
+  name: string
+  parent_class_id?: string | null
+}): Class {
+  return {
+    id: overrides.id,
+    name: overrides.name,
+    parent_class_id: overrides.parent_class_id ?? null,
+    description: '',
+    version_id: 'v1',
+    is_abstract: false,
+    attributes: {},
+    created_at: '2024-01-01T00:00:00Z',
+  } as Class
+}
+
+describe('buildClassTree', () => {
+  it('returns empty tree structure when class list is empty', () => {
+    const result = buildClassTree([])
+    expect(result.rootItem).toBe('root')
+    expect(result.items.root.children).toEqual([])
+  })
+
+  it('handles single root node', () => {
+    const classes = [makeClass({ id: '1', name: 'Thing' })]
+    const result = buildClassTree(classes)
+    expect(result.items.root.children).toEqual(['1'])
+    expect(result.items['1'].data?.name).toBe('Thing')
+    expect(result.items['1'].children).toEqual([])
+  })
+
+  it('handles multiple root nodes', () => {
+    const classes = [
+      makeClass({ id: '1', name: 'Animal' }),
+      makeClass({ id: '2', name: 'Plant' }),
+    ]
+    const result = buildClassTree(classes)
+    expect(result.items.root.children).toEqual(['1', '2'])
+  })
+
+  it('root nodes are those with parent_class_id === null', () => {
+    const classes = [
+      makeClass({ id: '1', name: 'Root', parent_class_id: null }),
+      makeClass({ id: '2', name: 'Child', parent_class_id: '1' }),
+    ]
+    const result = buildClassTree(classes)
+    expect(result.items.root.children).toEqual(['1'])
+    expect(result.items['1'].children).toEqual(['2'])
+  })
+
+  it('groups children by parent_class_id', () => {
+    const classes = [
+      makeClass({ id: '1', name: 'Parent' }),
+      makeClass({ id: '2', name: 'ChildA', parent_class_id: '1' }),
+      makeClass({ id: '3', name: 'ChildB', parent_class_id: '1' }),
+    ]
+    const result = buildClassTree(classes)
+    expect(result.items['1'].children).toEqual(['2', '3'])
+  })
+
+  it('handles deeply nested hierarchy (3+ levels)', () => {
+    const classes = [
+      makeClass({ id: '1', name: 'L1' }),
+      makeClass({ id: '2', name: 'L2', parent_class_id: '1' }),
+      makeClass({ id: '3', name: 'L3', parent_class_id: '2' }),
+    ]
+    const result = buildClassTree(classes)
+    expect(result.items.root.children).toEqual(['1'])
+    expect(result.items['1'].children).toEqual(['2'])
+    expect(result.items['2'].children).toEqual(['3'])
+    expect(result.items['3'].children).toEqual([])
+  })
+
+  it('handles class with no children (leaf node)', () => {
+    const classes = [makeClass({ id: '1', name: 'Leaf' })]
+    const result = buildClassTree(classes)
+    expect(result.items['1'].children).toEqual([])
+  })
+
+  it('orphaned nodes (parent_class_id references non-existent parent) become root nodes', () => {
+    const classes = [
+      makeClass({ id: '1', name: 'Orphan', parent_class_id: 'nonexistent' }),
+    ]
+    const result = buildClassTree(classes)
+    expect(result.items.root.children).toEqual(['1'])
+  })
+
+  it('children are sorted alphabetically by name at each level', () => {
+    const classes = [
+      makeClass({ id: '1', name: 'Parent' }),
+      makeClass({ id: '2', name: 'Zebra', parent_class_id: '1' }),
+      makeClass({ id: '3', name: 'Apple', parent_class_id: '1' }),
+      makeClass({ id: '4', name: 'Mango', parent_class_id: '1' }),
+    ]
+    const result = buildClassTree(classes)
+    expect(result.items['1'].children).toEqual(['3', '4', '2'])
+  })
+
+  it('converts to headless-tree format with rootItem, items record, and children arrays', () => {
+    const classes = [
+      makeClass({ id: '1', name: 'Root' }),
+      makeClass({ id: '2', name: 'Child', parent_class_id: '1' }),
+    ]
+    const result = buildClassTree(classes)
+
+    expect(result.rootItem).toBe('root')
+    expect(result.items).toHaveProperty('root')
+    expect(result.items).toHaveProperty('1')
+    expect(result.items).toHaveProperty('2')
+    expect(result.items.root.children).toEqual(['1'])
+    expect(result.items['1'].children).toEqual(['2'])
+    expect(result.items['1'].data).toBeDefined()
+    expect(result.items['2'].data).toBeDefined()
+    expect(result.items.root.data).toBeUndefined()
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassTree/buildClassTree.ts b/frontend/src/features/ontology/components/ClassTree/buildClassTree.ts
new file mode 100644
index 0000000..c6615ef
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/buildClassTree.ts
@@ -0,0 +1,62 @@
+import type { Class } from '@/features/ontology/lib/api'
+
+export interface TreeItem {
+  children: string[]
+  data?: Class
+}
+
+export interface ClassTreeData {
+  rootItem: string
+  items: Record<string, TreeItem>
+}
+
+export function buildClassTree(classes: Class[]): ClassTreeData {
+  if (classes.length === 0) {
+    return { rootItem: 'root', items: { root: { children: [] } } }
+  }
+
+  // 1. Create Map for O(1) lookup
+  const classMap = new Map<string, Class>()
+  for (const cls of classes) {
+    classMap.set(cls.id, cls)
+  }
+
+  // 2. Group children by parent_class_id
+  const childrenMap = new Map<string, string[]>()
+  const rootIds: string[] = []
+
+  for (const cls of classes) {
+    const parentId = cls.parent_class_id
+    if (!parentId || !classMap.has(parentId)) {
+      // Root node: null parent or orphaned (parent doesn't exist)
+      rootIds.push(cls.id)
+    } else {
+      const siblings = childrenMap.get(parentId) ?? []
+      siblings.push(cls.id)
+      childrenMap.set(parentId, siblings)
+    }
+  }
+
+  // 3. Sort function: alphabetical by name
+  const sortByName = (a: string, b: string) => {
+    const nameA = classMap.get(a)?.name ?? ''
+    const nameB = classMap.get(b)?.name ?? ''
+    return nameA.localeCompare(nameB)
+  }
+
+  // 4. Sort root nodes
+  rootIds.sort(sortByName)
+
+  // 5. Build items record
+  const items: Record<string, TreeItem> = {
+    root: { children: rootIds },
+  }
+
+  for (const cls of classes) {
+    const children = childrenMap.get(cls.id) ?? []
+    children.sort(sortByName)
+    items[cls.id] = { children, data: cls }
+  }
+
+  return { rootItem: 'root', items }
+}
diff --git a/frontend/src/features/ontology/components/ClassTree/useClassTree.test.tsx b/frontend/src/features/ontology/components/ClassTree/useClassTree.test.tsx
new file mode 100644
index 0000000..1283b13
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/useClassTree.test.tsx
@@ -0,0 +1,208 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { renderHook, waitFor, act } from '@testing-library/react'
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
+import type { ReactNode } from 'react'
+import type { Class } from '@/features/ontology/lib/api'
+
+vi.mock('@/features/ontology/lib/api', () => ({
+  fetchClasses: vi.fn(),
+}))
+
+import { fetchClasses } from '@/features/ontology/lib/api'
+import { useClassTree } from './useClassTree'
+
+const mockedFetchClasses = vi.mocked(fetchClasses)
+
+function makeClass(overrides: {
+  id: string
+  name: string
+  parent_class_id?: string | null
+  source_id?: string
+}): Class {
+  return {
+    id: overrides.id,
+    name: overrides.name,
+    parent_class_id: overrides.parent_class_id ?? null,
+    description: '',
+    version_id: 'v1',
+    is_abstract: false,
+    attributes: {},
+    created_at: '2024-01-01T00:00:00Z',
+    ...(overrides.source_id ? { source_id: overrides.source_id } : {}),
+  } as Class
+}
+
+function createWrapper() {
+  const queryClient = new QueryClient({
+    defaultOptions: { queries: { retry: false } },
+  })
+  return function Wrapper({ children }: { children: ReactNode }) {
+    return (
+      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
+    )
+  }
+}
+
+beforeEach(() => {
+  vi.clearAllMocks()
+})
+
+describe('useClassTree', () => {
+  it('returns empty tree structure when class list is empty', async () => {
+    mockedFetchClasses.mockResolvedValue([])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+    expect(result.current.treeData?.items.root.children).toEqual([])
+  })
+
+  it('builds correct parent-child hierarchy from flat class list', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Parent' }),
+      makeClass({ id: '2', name: 'Child', parent_class_id: '1' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+    expect(result.current.treeData?.items.root.children).toEqual(['1'])
+    expect(result.current.treeData?.items['1'].children).toEqual(['2'])
+  })
+
+  it('root nodes are those with parent_class_id === null', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Root', parent_class_id: null }),
+      makeClass({ id: '2', name: 'Child', parent_class_id: '1' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+    expect(result.current.treeData?.items.root.children).toEqual(['1'])
+  })
+
+  it('orphaned nodes become root nodes', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Orphan', parent_class_id: 'nonexistent' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+    expect(result.current.treeData?.items.root.children).toEqual(['1'])
+  })
+
+  it('children are sorted alphabetically by name at each level', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Root' }),
+      makeClass({ id: '2', name: 'Zebra', parent_class_id: '1' }),
+      makeClass({ id: '3', name: 'Apple', parent_class_id: '1' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+    expect(result.current.treeData?.items['1'].children).toEqual(['3', '2'])
+  })
+
+  it('converts to headless-tree format', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Root' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+    expect(result.current.treeData?.rootItem).toBe('root')
+    expect(result.current.treeData?.items).toHaveProperty('root')
+    expect(result.current.treeData?.items).toHaveProperty('1')
+  })
+
+  it('text filter returns only matching nodes plus ancestors', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Vehicle' }),
+      makeClass({ id: '2', name: 'Car', parent_class_id: '1' }),
+      makeClass({ id: '3', name: 'Truck', parent_class_id: '1' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+
+    act(() => result.current.setSearchText('car'))
+
+    expect(result.current.treeData?.items.root.children).toEqual(['1'])
+    expect(result.current.treeData?.items['1'].children).toEqual(['2'])
+    // Truck should not be in filtered tree
+    expect(result.current.treeData?.items['3']).toBeUndefined()
+  })
+
+  it('text filter is case-insensitive', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Vehicle' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+
+    act(() => result.current.setSearchText('VEHICLE'))
+    expect(result.current.treeData?.items.root.children).toEqual(['1'])
+  })
+
+  it('source filter returns only matching classes plus ancestors', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Root' }),
+      makeClass({ id: '2', name: 'FromA', parent_class_id: '1', source_id: 'src-a' }),
+      makeClass({ id: '3', name: 'FromB', parent_class_id: '1', source_id: 'src-b' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+
+    act(() => result.current.setSourceFilter('src-a'))
+
+    // Root (ancestor) and FromA should be visible
+    expect(result.current.treeData?.items.root.children).toEqual(['1'])
+    expect(result.current.treeData?.items['1'].children).toEqual(['2'])
+    expect(result.current.treeData?.items['3']).toBeUndefined()
+  })
+
+  it('source filter is no-op when no classes have source_id', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Root' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+
+    act(() => result.current.setSourceFilter('nonexistent'))
+
+    // No classes match, so root has no children
+    expect(result.current.treeData?.items.root.children).toEqual([])
+  })
+
+  it('combined text + source filter applies both conditions', async () => {
+    mockedFetchClasses.mockResolvedValue([
+      makeClass({ id: '1', name: 'Root' }),
+      makeClass({ id: '2', name: 'Car', parent_class_id: '1', source_id: 'src-a' }),
+      makeClass({ id: '3', name: 'Carpet', parent_class_id: '1', source_id: 'src-b' }),
+    ])
+    const { result } = renderHook(() => useClassTree(), {
+      wrapper: createWrapper(),
+    })
+    await waitFor(() => expect(result.current.isLoading).toBe(false))
+
+    act(() => {
+      result.current.setSearchText('car')
+      result.current.setSourceFilter('src-a')
+    })
+
+    // Only Car (matches both) + Root (ancestor) should be visible
+    expect(result.current.treeData?.items['1'].children).toEqual(['2'])
+    expect(result.current.treeData?.items['3']).toBeUndefined()
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassTree/useClassTree.ts b/frontend/src/features/ontology/components/ClassTree/useClassTree.ts
index 7a54ff6..4ae3489 100644
--- a/frontend/src/features/ontology/components/ClassTree/useClassTree.ts
+++ b/frontend/src/features/ontology/components/ClassTree/useClassTree.ts
@@ -1,5 +1,123 @@
-/** Hook: fetch classes, build tree hierarchy, manage search/filter state */
-export function useClassTree() {
-  // Implemented in Section 02
-  return { treeItems: {}, rootIds: [] as string[], isLoading: true }
+import { useState, useMemo } from 'react'
+import { useQuery } from '@tanstack/react-query'
+import { fetchClasses } from '@/features/ontology/lib/api'
+import type { Class } from '@/features/ontology/lib/api'
+import { buildClassTree, type ClassTreeData } from './buildClassTree'
+
+// source_id is not on the Class type yet — graceful degradation for Split 01
+function getSourceId(cls: Class): string | undefined {
+  return 'source_id' in cls
+    ? (cls as Class & { source_id?: string }).source_id
+    : undefined
+}
+
+export interface UseClassTreeReturn {
+  treeData: ClassTreeData | undefined
+  classList: Class[]
+  isLoading: boolean
+  error: Error | null
+  searchText: string
+  setSearchText: (text: string) => void
+  sourceFilter: string | null
+  setSourceFilter: (sourceId: string | null) => void
+  availableSources: string[]
+}
+
+export function useClassTree(): UseClassTreeReturn {
+  const [searchText, setSearchText] = useState('')
+  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
+
+  const {
+    data: classList,
+    isLoading,
+    error,
+  } = useQuery({
+    queryKey: ['classes', 'list'],
+    queryFn: fetchClasses,
+    staleTime: 5 * 60 * 1000,
+  })
+
+  // Build full tree from class list
+  const fullTree = useMemo(() => {
+    if (!classList) return undefined
+    return buildClassTree(classList)
+  }, [classList])
+
+  // Build class map for ancestor lookups
+  const classMap = useMemo(() => {
+    if (!classList) return new Map<string, Class>()
+    const map = new Map<string, Class>()
+    for (const cls of classList) {
+      map.set(cls.id, cls)
+    }
+    return map
+  }, [classList])
+
+  // Extract available sources for the filter dropdown
+  const availableSources = useMemo(() => {
+    if (!classList) return []
+    const sources = new Set<string>()
+    for (const cls of classList) {
+      const sourceId = getSourceId(cls)
+      if (sourceId) sources.add(sourceId)
+    }
+    return [...sources].sort()
+  }, [classList])
+
+  // Apply filters
+  const treeData = useMemo(() => {
+    if (!fullTree || !classList) return fullTree
+    if (!searchText && !sourceFilter) return fullTree
+
+    // Find matching node IDs
+    const matchingIds = new Set<string>()
+    for (const cls of classList) {
+      const matchesText = !searchText || cls.name.toLowerCase().includes(searchText.toLowerCase())
+      const sourceId = getSourceId(cls)
+      const matchesSource = !sourceFilter || sourceId === sourceFilter
+      if (matchesText && matchesSource) {
+        matchingIds.add(cls.id)
+      }
+    }
+
+    // Collect ancestor paths for matching nodes
+    const visibleIds = new Set<string>(matchingIds)
+    for (const id of matchingIds) {
+      let current = classMap.get(id)
+      while (current?.parent_class_id && classMap.has(current.parent_class_id)) {
+        visibleIds.add(current.parent_class_id)
+        current = classMap.get(current.parent_class_id)
+      }
+    }
+
+    // Rebuild filtered tree
+    const filteredItems: Record<string, { children: string[]; data?: Class }> = {
+      root: {
+        children: fullTree.items.root.children.filter((id) => visibleIds.has(id)),
+      },
+    }
+    for (const id of visibleIds) {
+      const original = fullTree.items[id]
+      if (original) {
+        filteredItems[id] = {
+          children: original.children.filter((childId) => visibleIds.has(childId)),
+          data: original.data,
+        }
+      }
+    }
+
+    return { rootItem: 'root' as const, items: filteredItems }
+  }, [fullTree, classList, classMap, searchText, sourceFilter])
+
+  return {
+    treeData,
+    classList: classList ?? [],
+    isLoading,
+    error: error as Error | null,
+    searchText,
+    setSearchText,
+    sourceFilter,
+    setSourceFilter,
+    availableSources,
+  }
 }
