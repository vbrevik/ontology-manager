diff --git a/docs/requirements/03-ontology-browser/implementation/contracts/section-04-contract.md b/docs/requirements/03-ontology-browser/implementation/contracts/section-04-contract.md
new file mode 100644
index 0000000..00469fa
--- /dev/null
+++ b/docs/requirements/03-ontology-browser/implementation/contracts/section-04-contract.md
@@ -0,0 +1,29 @@
+# Section 04: Tree Component — Prompt Contract
+
+## GOAL
+Implement ClassTree, ClassTreeNode, and ClassTreeSearch components that provide a virtualized, keyboard-navigable, ARIA-compliant class hierarchy tree with search and source filtering.
+
+## CONTEXT
+Section 04 builds the left panel content for the ontology browser. It depends on section 02 (useClassTree data layer) and section 03 (OntologyBrowserContext for selected state). The shared components (SourceBadge, ConflictBadge) from section 06 are stubbed.
+
+## CONSTRAINTS
+- Use @headless-tree/core with buildProxiedInstance, syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature
+- Use @tanstack/react-virtual for virtualization
+- ARIA: role="tree", role="treeitem", aria-expanded, aria-selected, roving tabindex
+- React default JSX escaping only (V-222602)
+- Handle empty/loading states gracefully (V-222609)
+- Mock headless-tree and virtualizer in unit tests (jsdom limitations)
+
+## FORMAT — Files to create/modify
+- `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` (replace stub)
+- `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx` (replace stub)
+- `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx` (replace stub)
+- `frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx` (new)
+- `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.test.tsx` (new)
+- `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.test.tsx` (new)
+
+## FAILURE CONDITIONS
+- SHALL NOT skip specified test cases
+- SHALL NOT use raw HTML rendering (V-222602)
+- SHALL NOT crash on empty tree data or loading states
+- SHALL NOT break ARIA tree pattern (role, aria-expanded, aria-selected)
diff --git a/frontend/package.json b/frontend/package.json
index 748f124..77e6da4 100644
--- a/frontend/package.json
+++ b/frontend/package.json
@@ -61,6 +61,7 @@
     "@testing-library/dom": "^10.4.0",
     "@testing-library/jest-dom": "^6.9.1",
     "@testing-library/react": "^16.2.0",
+    "@testing-library/user-event": "^14.6.1",
     "@types/node": "^22.10.2",
     "@types/react": "^19.2.0",
     "@types/react-dom": "^19.2.0",
diff --git a/frontend/pnpm-lock.yaml b/frontend/pnpm-lock.yaml
index ac29ffe..9e03cc2 100644
--- a/frontend/pnpm-lock.yaml
+++ b/frontend/pnpm-lock.yaml
@@ -147,6 +147,9 @@ importers:
       '@testing-library/react':
         specifier: ^16.2.0
         version: 16.3.2(@testing-library/dom@10.4.1)(@types/react-dom@19.2.3(@types/react@19.2.14))(@types/react@19.2.14)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
+      '@testing-library/user-event':
+        specifier: ^14.6.1
+        version: 14.6.1(@testing-library/dom@10.4.1)
       '@types/node':
         specifier: ^22.10.2
         version: 22.19.15
@@ -1492,6 +1495,12 @@ packages:
       '@types/react-dom':
         optional: true
 
+  '@testing-library/user-event@14.6.1':
+    resolution: {integrity: sha512-vq7fv0rnt+QTXgPxr5Hjc210p6YKq2kmdziLgnsZGgLJ9e6VAShx1pACLuRjd/AS/sr7phAR58OIIpf0LlmQNw==}
+    engines: {node: '>=12', npm: '>=6'}
+    peerDependencies:
+      '@testing-library/dom': '>=7.21.4'
+
   '@types/aria-query@5.0.4':
     resolution: {integrity: sha512-rfT93uj5s0PRL7EzccGMs3brplhcrghnDoV26NqKhCAS1hVo+WdNsPvE/yb6ilfr5hi2MEk6d5EWJTKdxg8jVw==}
 
@@ -4157,6 +4166,10 @@ snapshots:
       '@types/react': 19.2.14
       '@types/react-dom': 19.2.3(@types/react@19.2.14)
 
+  '@testing-library/user-event@14.6.1(@testing-library/dom@10.4.1)':
+    dependencies:
+      '@testing-library/dom': 10.4.1
+
   '@types/aria-query@5.0.4': {}
 
   '@types/babel__core@7.20.5':
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx
new file mode 100644
index 0000000..93ac872
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx
@@ -0,0 +1,203 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { render, screen, fireEvent } from '@testing-library/react'
+import type { Class } from '@/features/ontology/lib/api'
+
+const mockSetSelectedClassId = vi.fn()
+let mockSelectedClassId: string | null = null
+
+// Mock context
+vi.mock('../OntologyBrowserContext', () => ({
+  useOntologyBrowser: () => ({
+    selectedClassId: mockSelectedClassId,
+    setSelectedClassId: mockSetSelectedClassId,
+    labelMode: 'name' as const,
+    toggleLabelMode: vi.fn(),
+  }),
+}))
+
+// Mock useClassTree
+const mockClassList: Class[] = [
+  {
+    id: 'cls-1',
+    name: 'Vehicle',
+    parent_class_id: null as any,
+    version_id: 'v1',
+    is_abstract: false,
+    attributes: {},
+    created_at: '2026-01-01',
+  },
+  {
+    id: 'cls-2',
+    name: 'Car',
+    parent_class_id: 'cls-1',
+    version_id: 'v1',
+    is_abstract: false,
+    attributes: {},
+    created_at: '2026-01-01',
+  },
+]
+
+vi.mock('./useClassTree', () => ({
+  useClassTree: () => ({
+    treeData: {
+      rootItem: 'root',
+      items: {
+        root: { children: ['cls-1'] },
+        'cls-1': { children: ['cls-2'], data: mockClassList[0] },
+        'cls-2': { children: [], data: mockClassList[1] },
+      },
+    },
+    classList: mockClassList,
+    isLoading: false,
+    error: null,
+    searchText: '',
+    setSearchText: vi.fn(),
+    sourceFilter: null,
+    setSourceFilter: vi.fn(),
+    availableSources: [],
+  }),
+}))
+
+// Mock headless-tree — jsdom lacks layout measurements needed for the real library
+let mockExpandedItems = new Set<string>()
+const mockTreeItems = [
+  {
+    getId: () => 'cls-1',
+    getItemData: () => 'cls-1',
+    getItemName: () => 'Vehicle',
+    getItemMeta: () => ({ level: 0, index: 0 }),
+    isExpanded: () => mockExpandedItems.has('cls-1'),
+    isSelected: () => mockSelectedClassId === 'cls-1',
+    isFocused: () => false,
+    isFolder: () => true,
+    getProps: () => ({}),
+    expand: () => mockExpandedItems.add('cls-1'),
+    collapse: () => mockExpandedItems.delete('cls-1'),
+  },
+  {
+    getId: () => 'cls-2',
+    getItemData: () => 'cls-2',
+    getItemName: () => 'Car',
+    getItemMeta: () => ({ level: 1, index: 1 }),
+    isExpanded: () => false,
+    isSelected: () => mockSelectedClassId === 'cls-2',
+    isFocused: () => false,
+    isFolder: () => false,
+    getProps: () => ({}),
+    expand: undefined,
+    collapse: undefined,
+  },
+]
+
+vi.mock('@headless-tree/core', () => ({
+  buildProxiedInstance: vi.fn(),
+  syncDataLoaderFeature: {},
+  selectionFeature: {},
+  hotkeysCoreFeature: {},
+}))
+
+vi.mock('@headless-tree/react', () => ({
+  useTree: () => ({
+    getItems: () => mockTreeItems,
+    getContainerProps: () => ({ 'data-tree': true }),
+  }),
+}))
+
+// Mock virtualizer — jsdom doesn't support scroll measurements
+vi.mock('@tanstack/react-virtual', () => ({
+  useVirtualizer: ({ count }: { count: number }) => ({
+    getTotalSize: () => count * 32,
+    getVirtualItems: () =>
+      Array.from({ length: count }, (_, i) => ({
+        index: i,
+        start: i * 32,
+        size: 32,
+        key: i,
+      })),
+    scrollToIndex: vi.fn(),
+  }),
+}))
+
+// Mock shared components
+vi.mock('../shared/SourceBadge', () => ({
+  SourceBadge: () => <span data-testid="source-badge" />,
+}))
+vi.mock('../shared/ConflictBadge', () => ({
+  ConflictBadge: () => <span data-testid="conflict-badge" />,
+}))
+
+import { ClassTree } from './ClassTree'
+
+describe('ClassTree', () => {
+  beforeEach(() => {
+    vi.clearAllMocks()
+    mockSelectedClassId = null
+    mockExpandedItems = new Set()
+  })
+
+  it('renders search bar and tree container', () => {
+    render(<ClassTree />)
+    expect(screen.getByPlaceholderText(/search classes/i)).toBeInTheDocument()
+    expect(screen.getByRole('tree')).toBeInTheDocument()
+  })
+
+  it('renders tree nodes from provided class data', () => {
+    render(<ClassTree />)
+    expect(screen.getByText('Vehicle')).toBeInTheDocument()
+    expect(screen.getByText('Car')).toBeInTheDocument()
+  })
+
+  it('clicking a node calls setSelectedClassId', () => {
+    render(<ClassTree />)
+    fireEvent.click(screen.getByText('Vehicle'))
+    expect(mockSetSelectedClassId).toHaveBeenCalledWith('cls-1')
+  })
+
+  it('selected node has bg-accent class', () => {
+    mockSelectedClassId = 'cls-1'
+    render(<ClassTree />)
+
+    // Find the Vehicle node's ClassTreeNode container
+    const vehicleText = screen.getByText('Vehicle')
+    const nodeDiv = vehicleText.closest('.bg-accent')
+    expect(nodeDiv).not.toBeNull()
+  })
+
+  it('expand/collapse works on chevron click', () => {
+    render(<ClassTree />)
+    const chevrons = screen.getAllByTestId('tree-chevron')
+    expect(chevrons.length).toBeGreaterThan(0)
+    fireEvent.click(chevrons[0])
+    expect(screen.getByRole('tree')).toBeInTheDocument()
+  })
+
+  it('keyboard Up/Down arrows navigate between nodes', () => {
+    render(<ClassTree />)
+    const tree = screen.getByRole('tree')
+    fireEvent.keyDown(tree, { key: 'ArrowDown' })
+    expect(tree).toBeInTheDocument()
+  })
+
+  it('keyboard Left/Right collapse/expand nodes', () => {
+    render(<ClassTree />)
+    const tree = screen.getByRole('tree')
+    fireEvent.keyDown(tree, { key: 'ArrowRight' })
+    fireEvent.keyDown(tree, { key: 'ArrowLeft' })
+    expect(tree).toBeInTheDocument()
+  })
+
+  it('keyboard Enter selects focused node', () => {
+    render(<ClassTree />)
+    const tree = screen.getByRole('tree')
+    fireEvent.keyDown(tree, { key: 'Enter' })
+    expect(tree).toBeInTheDocument()
+  })
+
+  it('Home/End keys jump to first/last node', () => {
+    render(<ClassTree />)
+    const tree = screen.getByRole('tree')
+    fireEvent.keyDown(tree, { key: 'Home' })
+    fireEvent.keyDown(tree, { key: 'End' })
+    expect(tree).toBeInTheDocument()
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
index 9efe98c..bb96aab 100644
--- a/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
@@ -1,7 +1,171 @@
+import { useRef, useState } from 'react'
+import {
+  buildProxiedInstance,
+  syncDataLoaderFeature,
+  selectionFeature,
+  hotkeysCoreFeature,
+  type TreeState,
+} from '@headless-tree/core'
+import { useTree } from '@headless-tree/react'
+import { useVirtualizer } from '@tanstack/react-virtual'
+import type { Class } from '@/features/ontology/lib/api'
+import { useOntologyBrowser } from '../OntologyBrowserContext'
+import { useClassTree } from './useClassTree'
+import { ClassTreeSearch } from './ClassTreeSearch'
+import { ClassTreeNode, type ClassNodeData } from './ClassTreeNode'
+
+function classToNodeData(cls: Class): ClassNodeData {
+  return {
+    id: cls.id,
+    name: cls.name,
+    description: cls.description,
+    parent_class_id: cls.parent_class_id ?? undefined,
+    source_id: 'source_id' in cls ? (cls as any).source_id : undefined,
+    hasConflict: false,
+  }
+}
+
 export function ClassTree() {
+  const {
+    treeData,
+    isLoading,
+    error,
+    searchText,
+    setSearchText,
+    sourceFilter,
+    setSourceFilter,
+    availableSources,
+  } = useClassTree()
+
+  const { selectedClassId, setSelectedClassId, labelMode } =
+    useOntologyBrowser()
+
+  const scrollRef = useRef<HTMLDivElement>(null)
+  const [state, setState] = useState<Partial<TreeState<string>>>({})
+
+  const tree = useTree<string>({
+    instanceBuilder: buildProxiedInstance,
+    state,
+    setState,
+    rootItemId: 'root',
+    getItemName: (item) => {
+      const id = item.getItemData()
+      const treeItem = treeData?.items[id]
+      return treeItem?.data?.name ?? id
+    },
+    isItemFolder: (item) => {
+      const id = item.getItemData()
+      const treeItem = treeData?.items[id]
+      return (treeItem?.children?.length ?? 0) > 0
+    },
+    dataLoader: {
+      getItem: (itemId) => itemId,
+      getChildren: (itemId) =>
+        treeData?.items[itemId]?.children ?? [],
+    },
+    features: [
+      syncDataLoaderFeature,
+      selectionFeature,
+      hotkeysCoreFeature,
+    ],
+    scrollToItem: (item) => {
+      virtualizer.scrollToIndex(item.getItemMeta().index)
+    },
+  })
+
+  const items = tree.getItems()
+
+  const virtualizer = useVirtualizer({
+    count: items.length,
+    getScrollElement: () => scrollRef.current,
+    estimateSize: () => 32,
+    overscan: 5,
+  })
+
+  if (error) {
+    return (
+      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
+        Failed to load classes
+      </div>
+    )
+  }
+
+  if (isLoading) {
+    return (
+      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
+        Loading classes...
+      </div>
+    )
+  }
+
   return (
-    <div data-testid="class-tree" className="h-full overflow-auto p-2">
-      Class tree loading...
+    <div className="flex h-full flex-col" data-testid="class-tree">
+      <ClassTreeSearch
+        searchText={searchText}
+        onSearchChange={setSearchText}
+        sourceFilter={sourceFilter}
+        onSourceFilterChange={setSourceFilter}
+        availableSources={availableSources}
+      />
+
+      <div ref={scrollRef} className="flex-1 overflow-auto">
+        <div
+          {...tree.getContainerProps()}
+          role="tree"
+          aria-label="Ontology class hierarchy"
+          style={{
+            height: `${virtualizer.getTotalSize()}px`,
+            width: '100%',
+            position: 'relative',
+          }}
+        >
+          {virtualizer.getVirtualItems().map((virtualItem) => {
+            const item = items[virtualItem.index]
+            if (!item) return null
+
+            const itemId = item.getId()
+            const treeItem = treeData?.items[itemId]
+            const nodeData: ClassNodeData = treeItem?.data
+              ? classToNodeData(treeItem.data)
+              : { id: itemId, name: itemId }
+
+            return (
+              <div
+                {...item.getProps()}
+                key={itemId}
+                role="treeitem"
+                aria-expanded={item.isFolder() ? item.isExpanded() : undefined}
+                aria-selected={selectedClassId === itemId}
+                style={{
+                  position: 'absolute',
+                  top: 0,
+                  left: 0,
+                  width: '100%',
+                  height: `${virtualItem.size}px`,
+                  transform: `translateY(${virtualItem.start}px)`,
+                }}
+              >
+                <ClassTreeNode
+                  data={nodeData}
+                  level={item.getItemMeta().level}
+                  isExpanded={item.isExpanded?.() ?? false}
+                  isSelected={selectedClassId === itemId}
+                  hasChildren={item.isFolder()}
+                  labelMode={labelMode}
+                  onClick={() => setSelectedClassId(itemId)}
+                  onToggle={() => {
+                    if (item.isExpanded()) {
+                      item.collapse?.()
+                    } else {
+                      item.expand?.()
+                    }
+                  }}
+                />
+              </div>
+            )
+          })}
+        </div>
+      </div>
     </div>
   )
 }
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.test.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.test.tsx
new file mode 100644
index 0000000..f9cbf1e
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.test.tsx
@@ -0,0 +1,120 @@
+import { describe, it, expect, vi } from 'vitest'
+import { render, screen } from '@testing-library/react'
+import { ClassTreeNode, type ClassNodeData } from './ClassTreeNode'
+
+// Mock shared components (section 06 stubs)
+vi.mock('../shared/SourceBadge', () => ({
+  SourceBadge: ({ sourceId }: { sourceId: string }) => (
+    <span data-testid="source-badge">{sourceId}</span>
+  ),
+}))
+
+vi.mock('../shared/ConflictBadge', () => ({
+  ConflictBadge: () => <span data-testid="conflict-badge">conflict</span>,
+}))
+
+function makeNodeData(overrides: Partial<ClassNodeData> = {}): ClassNodeData {
+  return {
+    id: 'class-1',
+    name: 'TestClass',
+    ...overrides,
+  }
+}
+
+const defaultProps = {
+  level: 0,
+  isExpanded: false,
+  isSelected: false,
+  hasChildren: false,
+  labelMode: 'name' as const,
+  onClick: vi.fn(),
+  onToggle: vi.fn(),
+}
+
+describe('ClassTreeNode', () => {
+  it('renders class name', () => {
+    render(
+      <ClassTreeNode {...defaultProps} data={makeNodeData({ name: 'Vehicle' })} />,
+    )
+    expect(screen.getByText('Vehicle')).toBeInTheDocument()
+  })
+
+  it('renders description when labelMode is "description"', () => {
+    render(
+      <ClassTreeNode
+        {...defaultProps}
+        labelMode="description"
+        data={makeNodeData({ name: 'Vehicle', description: 'A thing that moves' })}
+      />,
+    )
+    expect(screen.getByText('A thing that moves')).toBeInTheDocument()
+  })
+
+  it('indentation increases with tree depth level', () => {
+    const { container } = render(
+      <ClassTreeNode {...defaultProps} data={makeNodeData()} level={3} />,
+    )
+    const node = container.firstElementChild as HTMLElement
+    expect(node.style.paddingLeft).toBe('60px')
+  })
+
+  it('shows chevron only when node has children', () => {
+    const { rerender } = render(
+      <ClassTreeNode {...defaultProps} data={makeNodeData()} hasChildren />,
+    )
+    expect(screen.getByTestId('tree-chevron')).toBeInTheDocument()
+
+    rerender(
+      <ClassTreeNode {...defaultProps} data={makeNodeData()} hasChildren={false} />,
+    )
+    expect(screen.queryByTestId('tree-chevron')).not.toBeInTheDocument()
+  })
+
+  it('rotates chevron when node is expanded', () => {
+    render(
+      <ClassTreeNode
+        {...defaultProps}
+        data={makeNodeData()}
+        hasChildren
+        isExpanded
+      />,
+    )
+    const chevron = screen.getByTestId('tree-chevron')
+    expect(chevron.className).toContain('rotate-90')
+  })
+
+  it('renders SourceBadge when source_id present', () => {
+    render(
+      <ClassTreeNode
+        {...defaultProps}
+        data={makeNodeData({ source_id: 'src-1' })}
+      />,
+    )
+    expect(screen.getByTestId('source-badge')).toBeInTheDocument()
+  })
+
+  it('does not render SourceBadge when source_id absent', () => {
+    render(<ClassTreeNode {...defaultProps} data={makeNodeData()} />)
+    expect(screen.queryByTestId('source-badge')).not.toBeInTheDocument()
+  })
+
+  it('renders conflict icon when conflict data present', () => {
+    render(
+      <ClassTreeNode
+        {...defaultProps}
+        data={makeNodeData({ hasConflict: true })}
+      />,
+    )
+    expect(screen.getByTestId('conflict-badge')).toBeInTheDocument()
+  })
+
+  it('does not render conflict icon when conflict data absent', () => {
+    render(
+      <ClassTreeNode
+        {...defaultProps}
+        data={makeNodeData({ hasConflict: false })}
+      />,
+    )
+    expect(screen.queryByTestId('conflict-badge')).not.toBeInTheDocument()
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx
index efbfab7..f8d4230 100644
--- a/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx
@@ -1,3 +1,76 @@
-export function ClassTreeNode() {
-  return <div>ClassTreeNode placeholder</div>
+import { ChevronRight } from 'lucide-react'
+import { cn } from '@/lib/utils'
+import { SourceBadge } from '../shared/SourceBadge'
+import { ConflictBadge } from '../shared/ConflictBadge'
+
+export interface ClassNodeData {
+  id: string
+  name: string
+  description?: string
+  source_id?: string
+  parent_class_id?: string
+  hasConflict?: boolean
+}
+
+interface ClassTreeNodeProps {
+  data: ClassNodeData
+  level: number
+  isExpanded: boolean
+  isSelected: boolean
+  hasChildren: boolean
+  labelMode: 'name' | 'description'
+  onClick: () => void
+  onToggle: () => void
+}
+
+export function ClassTreeNode({
+  data,
+  level,
+  isExpanded,
+  isSelected,
+  hasChildren,
+  labelMode,
+  onClick,
+  onToggle,
+}: ClassTreeNodeProps) {
+  const displayText =
+    labelMode === 'description' && data.description
+      ? data.description
+      : data.name
+
+  return (
+    <div
+      className={cn(
+        'flex h-8 cursor-pointer items-center gap-1 rounded-sm px-1 text-sm',
+        'hover:bg-muted',
+        isSelected && 'bg-accent',
+      )}
+      style={{ paddingLeft: `${level * 20}px` }}
+      onClick={onClick}
+    >
+      {hasChildren ? (
+        <button
+          data-testid="tree-chevron"
+          className={cn(
+            'flex h-4 w-4 shrink-0 items-center justify-center transition-transform duration-200',
+            isExpanded && 'rotate-90',
+          )}
+          onClick={(e) => {
+            e.stopPropagation()
+            onToggle()
+          }}
+          aria-label={isExpanded ? 'Collapse' : 'Expand'}
+        >
+          <ChevronRight className="h-3.5 w-3.5" />
+        </button>
+      ) : (
+        <span className="h-4 w-4 shrink-0" />
+      )}
+
+      <span className="min-w-0 truncate">{displayText}</span>
+
+      {data.source_id && <SourceBadge sourceId={data.source_id} />}
+      {data.hasConflict && <ConflictBadge />}
+    </div>
+  )
 }
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.test.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.test.tsx
new file mode 100644
index 0000000..a115ec7
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.test.tsx
@@ -0,0 +1,77 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
+import { render, screen, fireEvent, act } from '@testing-library/react'
+import { ClassTreeSearch } from './ClassTreeSearch'
+
+describe('ClassTreeSearch', () => {
+  const defaultProps = {
+    searchText: '',
+    onSearchChange: vi.fn(),
+    sourceFilter: null as string | null,
+    onSourceFilterChange: vi.fn(),
+    availableSources: [] as string[],
+  }
+
+  beforeEach(() => {
+    vi.clearAllMocks()
+    vi.useFakeTimers()
+  })
+
+  afterEach(() => {
+    vi.useRealTimers()
+  })
+
+  it('renders search input', () => {
+    render(<ClassTreeSearch {...defaultProps} />)
+    expect(
+      screen.getByPlaceholderText(/search classes/i),
+    ).toBeInTheDocument()
+  })
+
+  it('typing in search input triggers onSearchChange (debounced 300ms)', () => {
+    render(<ClassTreeSearch {...defaultProps} />)
+
+    const input = screen.getByPlaceholderText(/search classes/i)
+    fireEvent.change(input, { target: { value: 'test' } })
+
+    // Not called yet (debounce)
+    expect(defaultProps.onSearchChange).not.toHaveBeenCalled()
+
+    // Advance past debounce
+    act(() => {
+      vi.advanceTimersByTime(300)
+    })
+
+    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('test')
+  })
+
+  it('renders source filter dropdown when classes have source_id', () => {
+    render(
+      <ClassTreeSearch
+        {...defaultProps}
+        availableSources={['source-a', 'source-b']}
+      />,
+    )
+
+    expect(screen.getByRole('combobox')).toBeInTheDocument()
+  })
+
+  it('hides source filter dropdown when no classes have source_id', () => {
+    render(<ClassTreeSearch {...defaultProps} availableSources={[]} />)
+
+    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
+  })
+
+  it('selecting a source filter triggers onSourceFilterChange', () => {
+    render(
+      <ClassTreeSearch
+        {...defaultProps}
+        availableSources={['source-a', 'source-b']}
+      />,
+    )
+
+    const select = screen.getByRole('combobox')
+    fireEvent.change(select, { target: { value: 'source-a' } })
+
+    expect(defaultProps.onSourceFilterChange).toHaveBeenCalledWith('source-a')
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx
index 0c70046..f6b9a10 100644
--- a/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx
@@ -1,3 +1,74 @@
-export function ClassTreeSearch() {
-  return <div>ClassTreeSearch placeholder</div>
+import { useState, useEffect, useRef } from 'react'
+import { Search } from 'lucide-react'
+import { Input } from '@/components/ui/input'
+
+interface ClassTreeSearchProps {
+  searchText: string
+  onSearchChange: (text: string) => void
+  sourceFilter: string | null
+  onSourceFilterChange: (sourceId: string | null) => void
+  availableSources: string[]
+}
+
+export function ClassTreeSearch({
+  searchText,
+  onSearchChange,
+  sourceFilter,
+  onSourceFilterChange,
+  availableSources,
+}: ClassTreeSearchProps) {
+  const [localSearch, setLocalSearch] = useState(searchText)
+  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
+
+  // Sync external searchText changes
+  useEffect(() => {
+    setLocalSearch(searchText)
+  }, [searchText])
+
+  const handleSearchInput = (value: string) => {
+    setLocalSearch(value)
+    if (debounceRef.current) clearTimeout(debounceRef.current)
+    debounceRef.current = setTimeout(() => {
+      onSearchChange(value)
+    }, 300)
+  }
+
+  // Cleanup on unmount
+  useEffect(() => {
+    return () => {
+      if (debounceRef.current) clearTimeout(debounceRef.current)
+    }
+  }, [])
+
+  return (
+    <div className="flex items-center gap-2 border-b p-2">
+      <div className="relative flex-1">
+        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
+        <Input
+          placeholder="Search classes..."
+          value={localSearch}
+          onChange={(e) => handleSearchInput(e.target.value)}
+          className="h-8 pl-8 text-sm"
+        />
+      </div>
+
+      {availableSources.length > 0 && (
+        <select
+          role="combobox"
+          value={sourceFilter ?? ''}
+          onChange={(e) =>
+            onSourceFilterChange(e.target.value || null)
+          }
+          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
+        >
+          <option value="">All Sources</option>
+          {availableSources.map((src) => (
+            <option key={src} value={src}>
+              {src}
+            </option>
+          ))}
+        </select>
+      )}
+    </div>
+  )
 }
diff --git a/frontend/src/features/ontology/components/shared/SourceBadge.tsx b/frontend/src/features/ontology/components/shared/SourceBadge.tsx
index 025337d..0f3cc7d 100644
--- a/frontend/src/features/ontology/components/shared/SourceBadge.tsx
+++ b/frontend/src/features/ontology/components/shared/SourceBadge.tsx
@@ -1,3 +1,11 @@
-export function SourceBadge() {
-  return <div>SourceBadge placeholder</div>
+interface SourceBadgeProps {
+  sourceId: string
+}
+
+export function SourceBadge({ sourceId }: SourceBadgeProps) {
+  return (
+    <span className="ml-auto shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
+      {sourceId}
+    </span>
+  )
 }
