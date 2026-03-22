diff --git a/docs/requirements/03-ontology-browser/implementation/contracts/section-05-contract.md b/docs/requirements/03-ontology-browser/implementation/contracts/section-05-contract.md
new file mode 100644
index 0000000..903524e
--- /dev/null
+++ b/docs/requirements/03-ontology-browser/implementation/contracts/section-05-contract.md
@@ -0,0 +1,26 @@
+# Section 05: Detail Panel — Prompt Contract
+
+## GOAL
+Implement the right-side detail panel showing class header, properties list, and conflict information when a class is selected in the tree.
+
+## CONTEXT
+Section 05 builds the right panel content. It reads selectedClassId from context (section 03), fetches data via useClassDetail (section 02), and displays it through ClassHeader, ClassProperties, and ClassConflicts sub-components.
+
+## CONSTRAINTS
+- Use existing useClassDetail hook from section 02 for data fetching
+- Section-06 shared components (SourceBadge, ConflictBadge, ClassLink) are stubs — mock in tests
+- Mutation wiring deferred to section 07 (inline editing) — accept callback props
+- React default JSX escaping only (V-222602)
+- Handle loading/empty/error states gracefully (V-222609)
+
+## FORMAT — Files to create/modify
+- `ClassDetail.tsx` + `ClassDetail.test.tsx` — container with placeholder/loading/data states
+- `ClassHeader.tsx` + `ClassHeader.test.tsx` — name, parent, source, description
+- `ClassProperties.tsx` + `ClassProperties.test.tsx` — property list with add/edit/delete UI
+- `ClassConflicts.tsx` + `ClassConflicts.test.tsx` — conflict comparison (graceful degradation)
+
+## FAILURE CONDITIONS
+- SHALL NOT skip specified test cases (5 + 7 + 7 + 3 = 22 tests)
+- SHALL NOT use raw HTML rendering (V-222602)
+- SHALL NOT crash on null/undefined data
+- SHALL NOT display stale data without loading indicator
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.test.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.test.tsx
new file mode 100644
index 0000000..2dc73e4
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.test.tsx
@@ -0,0 +1,31 @@
+import { describe, it, expect } from 'vitest'
+import { render, screen } from '@testing-library/react'
+import { ClassConflicts, type ConflictData } from './ClassConflicts'
+
+const sampleConflict: ConflictData = {
+  baseDefinition: { name: 'Vehicle', description: 'Base definition' },
+  extensionDefinition: { name: 'Vehicle', description: 'Extended' },
+  resolutionStatus: 'unresolved',
+}
+
+describe('ClassConflicts', () => {
+  it('renders two columns (Base Definition, Extension Definition)', () => {
+    render(<ClassConflicts conflictData={sampleConflict} />)
+
+    expect(screen.getByText('Base Definition')).toBeInTheDocument()
+    expect(screen.getByText('Extension Definition')).toBeInTheDocument()
+  })
+
+  it('shows resolution status label', () => {
+    render(<ClassConflicts conflictData={sampleConflict} />)
+    expect(screen.getByText('Unresolved')).toBeInTheDocument()
+  })
+
+  it('renders nothing when conflict data is null/undefined', () => {
+    const { container: c1 } = render(<ClassConflicts conflictData={null} />)
+    expect(c1.innerHTML).toBe('')
+
+    const { container: c2 } = render(<ClassConflicts conflictData={undefined} />)
+    expect(c2.innerHTML).toBe('')
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx
index 664cd68..34fb9a5 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx
@@ -1,3 +1,54 @@
-export function ClassConflicts() {
-  return <div>ClassConflicts placeholder</div>
+import { AlertTriangle } from 'lucide-react'
+import { Badge } from '@/components/ui/badge'
+
+export interface ConflictData {
+  baseDefinition: Record<string, any>
+  extensionDefinition: Record<string, any>
+  resolutionStatus: 'unresolved' | 'base_wins' | 'extension_wins'
+}
+
+interface ClassConflictsProps {
+  conflictData?: ConflictData | null
+}
+
+const statusLabels: Record<ConflictData['resolutionStatus'], string> = {
+  unresolved: 'Unresolved',
+  base_wins: 'Base wins',
+  extension_wins: 'Extension wins',
+}
+
+export function ClassConflicts({ conflictData }: ClassConflictsProps) {
+  if (!conflictData) return null
+
+  return (
+    <div className="space-y-3">
+      <div className="flex items-center gap-2">
+        <AlertTriangle className="h-4 w-4 text-amber-500" />
+        <h3 className="text-sm font-semibold">Conflicts</h3>
+      </div>
+
+      <div className="grid grid-cols-2 gap-4">
+        <div>
+          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
+            Base Definition
+          </h4>
+          <pre className="rounded-md bg-muted p-2 text-xs">
+            {JSON.stringify(conflictData.baseDefinition, null, 2)}
+          </pre>
+        </div>
+        <div>
+          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
+            Extension Definition
+          </h4>
+          <pre className="rounded-md bg-muted p-2 text-xs">
+            {JSON.stringify(conflictData.extensionDefinition, null, 2)}
+          </pre>
+        </div>
+      </div>
+
+      <Badge variant="outline">
+        {statusLabels[conflictData.resolutionStatus]}
+      </Badge>
+    </div>
+  )
 }
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx
new file mode 100644
index 0000000..91aa3e2
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx
@@ -0,0 +1,159 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { render, screen } from '@testing-library/react'
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
+
+let mockSelectedClassId: string | null = null
+let mockIsLoading = false
+let mockClassData: any = null
+let mockProperties: any[] = []
+
+vi.mock('../OntologyBrowserContext', () => ({
+  useOntologyBrowser: () => ({
+    selectedClassId: mockSelectedClassId,
+    setSelectedClassId: vi.fn(),
+    labelMode: 'name' as const,
+    toggleLabelMode: vi.fn(),
+  }),
+}))
+
+vi.mock('../ClassTree/useClassTree', () => ({
+  useClassTree: () => ({
+    classList: [
+      { id: 'cls-parent', name: 'ParentClass' },
+      { id: 'cls-1', name: 'Vehicle' },
+    ],
+    treeData: undefined,
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
+vi.mock('./useClassDetail', () => ({
+  useClassDetail: () => ({
+    classData: mockClassData,
+    properties: mockProperties,
+    currentVersion: { id: 'v1' },
+    isLoading: mockIsLoading,
+    isPlaceholderData: false,
+    error: null,
+    updateDescription: vi.fn(),
+    createProperty: vi.fn(),
+    updateProperty: vi.fn(),
+    deleteProperty: vi.fn(),
+  }),
+}))
+
+// Mock shared components
+vi.mock('../shared/SourceBadge', () => ({
+  SourceBadge: ({ sourceId }: { sourceId: string }) => (
+    <span data-testid="source-badge">{sourceId}</span>
+  ),
+}))
+vi.mock('../shared/ClassLink', () => ({
+  ClassLink: ({ children }: { children: React.ReactNode }) => (
+    <span data-testid="class-link">{children}</span>
+  ),
+}))
+
+import { ClassDetail } from './ClassDetail'
+
+function renderWithProviders() {
+  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
+  return render(
+    <QueryClientProvider client={qc}>
+      <ClassDetail />
+    </QueryClientProvider>,
+  )
+}
+
+describe('ClassDetail', () => {
+  beforeEach(() => {
+    mockSelectedClassId = null
+    mockIsLoading = false
+    mockClassData = null
+    mockProperties = []
+  })
+
+  it('shows "Select a class" placeholder when no class selected', () => {
+    renderWithProviders()
+    expect(screen.getByText(/select a class/i)).toBeInTheDocument()
+  })
+
+  it('renders ClassHeader and ClassProperties when class selected', () => {
+    mockSelectedClassId = 'cls-1'
+    mockClassData = {
+      id: 'cls-1',
+      name: 'Vehicle',
+      description: 'A vehicle',
+      parent_class_id: 'cls-parent',
+      version_id: 'v1',
+      is_abstract: false,
+      attributes: {},
+      created_at: '2026-01-01',
+    }
+    mockProperties = [
+      {
+        id: 'p1',
+        name: 'speed',
+        class_id: 'cls-1',
+        data_type: 'integer',
+        is_required: true,
+        is_unique: false,
+        version_id: 'v1',
+        validation_rules: null,
+      },
+    ]
+
+    renderWithProviders()
+    expect(screen.getByText('Vehicle')).toBeInTheDocument()
+    expect(screen.getByText('speed')).toBeInTheDocument()
+  })
+
+  it('renders ClassConflicts only when conflict data present', () => {
+    mockSelectedClassId = 'cls-1'
+    mockClassData = {
+      id: 'cls-1',
+      name: 'Vehicle',
+      version_id: 'v1',
+      is_abstract: false,
+      attributes: {},
+      created_at: '2026-01-01',
+      conflictData: {
+        baseDefinition: { name: 'Vehicle' },
+        extensionDefinition: { name: 'Vehicle2' },
+        resolutionStatus: 'unresolved',
+      },
+    }
+
+    renderWithProviders()
+    expect(screen.getByText('Conflicts')).toBeInTheDocument()
+  })
+
+  it('does not render ClassConflicts when no conflict data', () => {
+    mockSelectedClassId = 'cls-1'
+    mockClassData = {
+      id: 'cls-1',
+      name: 'Vehicle',
+      version_id: 'v1',
+      is_abstract: false,
+      attributes: {},
+      created_at: '2026-01-01',
+    }
+
+    renderWithProviders()
+    expect(screen.queryByText('Conflicts')).not.toBeInTheDocument()
+  })
+
+  it('shows loading skeleton while data is loading', () => {
+    mockSelectedClassId = 'cls-1'
+    mockIsLoading = true
+
+    renderWithProviders()
+    expect(screen.getByTestId('detail-skeleton')).toBeInTheDocument()
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
index cfa705e..739f59f 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
@@ -1,7 +1,78 @@
+import { useOntologyBrowser } from '../OntologyBrowserContext'
+import { useClassTree } from '../ClassTree/useClassTree'
+import { useClassDetail } from './useClassDetail'
+import { ClassHeader } from './ClassHeader'
+import { ClassProperties } from './ClassProperties'
+import { ClassConflicts } from './ClassConflicts'
+
+function DetailSkeleton() {
+  return (
+    <div className="space-y-4 p-4" data-testid="detail-skeleton">
+      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
+      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
+      <div className="h-16 w-full animate-pulse rounded bg-muted" />
+      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
+      <div className="space-y-2">
+        <div className="h-8 w-full animate-pulse rounded bg-muted" />
+        <div className="h-8 w-full animate-pulse rounded bg-muted" />
+      </div>
+    </div>
+  )
+}
+
 export function ClassDetail() {
+  const { selectedClassId } = useOntologyBrowser()
+  const { classList } = useClassTree()
+  const {
+    classData,
+    properties,
+    isLoading,
+    updateDescription,
+    createProperty,
+    deleteProperty,
+  } = useClassDetail(selectedClassId)
+
+  if (!selectedClassId) {
+    return (
+      <div
+        className="flex h-full items-center justify-center p-4 text-muted-foreground"
+        data-testid="class-detail"
+      >
+        Select a class to view details
+      </div>
+    )
+  }
+
+  if (isLoading || !classData) {
+    return <DetailSkeleton />
+  }
+
+  const parentClass = classData.parent_class_id
+    ? classList.find((c) => c.id === classData.parent_class_id)
+    : undefined
+
+  // Check for conflict data (graceful degradation)
+  const conflictData = 'conflictData' in classData
+    ? (classData as any).conflictData
+    : undefined
+
   return (
-    <div data-testid="class-detail" className="h-full overflow-auto p-4">
-      Select a class to view details
+    <div className="h-full overflow-y-auto p-4" data-testid="class-detail">
+      <div className="space-y-6">
+        <ClassHeader
+          classData={classData}
+          parentClassName={parentClass?.name}
+          onDescriptionSave={updateDescription}
+        />
+
+        <ClassProperties
+          properties={properties ?? []}
+          onAddProperty={(input) => createProperty(input)}
+          onDeleteProperty={deleteProperty}
+        />
+
+        <ClassConflicts conflictData={conflictData} />
+      </div>
     </div>
   )
 }
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx
new file mode 100644
index 0000000..a0fed9f
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx
@@ -0,0 +1,67 @@
+import { describe, it, expect, vi } from 'vitest'
+import { render, screen } from '@testing-library/react'
+import { ClassHeader } from './ClassHeader'
+import type { Class } from '@/features/ontology/lib/api'
+
+vi.mock('../shared/SourceBadge', () => ({
+  SourceBadge: ({ sourceId }: { sourceId: string }) => (
+    <span data-testid="source-badge">{sourceId}</span>
+  ),
+}))
+
+vi.mock('../shared/ClassLink', () => ({
+  ClassLink: ({ children }: { children: React.ReactNode }) => (
+    <span data-testid="class-link">{children}</span>
+  ),
+}))
+
+function makeClass(overrides: Partial<Class> = {}): Class {
+  return {
+    id: 'cls-1',
+    name: 'Vehicle',
+    version_id: 'v1',
+    is_abstract: false,
+    attributes: {},
+    created_at: '2026-01-01',
+    ...overrides,
+  }
+}
+
+describe('ClassHeader', () => {
+  it('renders class name as read-only text (not editable)', () => {
+    render(<ClassHeader classData={makeClass({ name: 'Vehicle' })} />)
+    expect(screen.getByText('Vehicle')).toBeInTheDocument()
+    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
+  })
+
+  it('renders parent class as clickable ClassLink', () => {
+    render(
+      <ClassHeader
+        classData={makeClass({ parent_class_id: 'parent-1' })}
+        parentClassName="TransportMode"
+      />,
+    )
+    expect(screen.getByTestId('class-link')).toBeInTheDocument()
+    expect(screen.getByText('TransportMode')).toBeInTheDocument()
+  })
+
+  it('renders SourceBadge when source_id present', () => {
+    const cls = { ...makeClass(), source_id: 'src-1' } as any
+    render(<ClassHeader classData={cls} />)
+    expect(screen.getByTestId('source-badge')).toBeInTheDocument()
+  })
+
+  it('hides SourceBadge when source_id absent', () => {
+    render(<ClassHeader classData={makeClass()} />)
+    expect(screen.queryByTestId('source-badge')).not.toBeInTheDocument()
+  })
+
+  it('renders description text', () => {
+    render(
+      <ClassHeader
+        classData={makeClass({ description: 'A motorized vehicle' })}
+      />,
+    )
+    expect(screen.getByText('A motorized vehicle')).toBeInTheDocument()
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
index c97093d..abfac53 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
@@ -1,3 +1,42 @@
-export function ClassHeader() {
-  return <div>ClassHeader placeholder</div>
+import type { Class } from '@/features/ontology/lib/api'
+import { SourceBadge } from '../shared/SourceBadge'
+import { ClassLink } from '../shared/ClassLink'
+
+interface ClassHeaderProps {
+  classData: Class
+  parentClassName?: string
+  onDescriptionSave?: (description: string) => void
+}
+
+export function ClassHeader({
+  classData,
+  parentClassName,
+}: ClassHeaderProps) {
+  const sourceId = 'source_id' in classData
+    ? (classData as Class & { source_id?: string }).source_id
+    : undefined
+
+  return (
+    <div className="space-y-3">
+      <div className="flex items-center gap-3">
+        <h2 className="text-2xl font-semibold">{classData.name}</h2>
+        {sourceId && <SourceBadge sourceId={sourceId} />}
+      </div>
+
+      {classData.parent_class_id && parentClassName && (
+        <div className="text-sm text-muted-foreground">
+          Parent:{' '}
+          <ClassLink classId={classData.parent_class_id}>
+            {parentClassName}
+          </ClassLink>
+        </div>
+      )}
+
+      {classData.description && (
+        <p className="text-sm text-muted-foreground">
+          {classData.description}
+        </p>
+      )}
+    </div>
+  )
 }
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassProperties.test.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassProperties.test.tsx
new file mode 100644
index 0000000..839a5c2
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassProperties.test.tsx
@@ -0,0 +1,93 @@
+import { describe, it, expect, vi } from 'vitest'
+import { render, screen, fireEvent } from '@testing-library/react'
+import { ClassProperties } from './ClassProperties'
+import type { Property } from '@/features/ontology/lib/api'
+
+function makeProperty(overrides: Partial<Property> = {}): Property {
+  return {
+    id: 'prop-1',
+    name: 'color',
+    class_id: 'cls-1',
+    data_type: 'string',
+    is_required: false,
+    is_unique: false,
+    version_id: 'v1',
+    validation_rules: null,
+    ...overrides,
+  }
+}
+
+describe('ClassProperties', () => {
+  it('renders property list with name, type, constraints', () => {
+    const props = [
+      makeProperty({ id: 'p1', name: 'color', data_type: 'string', is_required: true }),
+      makeProperty({ id: 'p2', name: 'weight', data_type: 'float', is_unique: true }),
+    ]
+    render(<ClassProperties properties={props} />)
+
+    expect(screen.getByText('color')).toBeInTheDocument()
+    expect(screen.getByText('string')).toBeInTheDocument()
+    expect(screen.getByText('Required')).toBeInTheDocument()
+    expect(screen.getByText('weight')).toBeInTheDocument()
+    expect(screen.getByText('float')).toBeInTheDocument()
+    expect(screen.getByText('Unique')).toBeInTheDocument()
+  })
+
+  it('renders "Add Property" button', () => {
+    render(<ClassProperties properties={[]} />)
+    expect(screen.getByText('Add Property')).toBeInTheDocument()
+  })
+
+  it('clicking Add opens inline form', () => {
+    render(<ClassProperties properties={[]} />)
+    fireEvent.click(screen.getByText('Add Property'))
+    expect(screen.getByTestId('add-property-form')).toBeInTheDocument()
+    expect(screen.getByPlaceholderText('Property name')).toBeInTheDocument()
+  })
+
+  it('submitting add form calls onAddProperty', () => {
+    const onAdd = vi.fn()
+    render(<ClassProperties properties={[]} onAddProperty={onAdd} />)
+
+    fireEvent.click(screen.getByText('Add Property'))
+    fireEvent.change(screen.getByPlaceholderText('Property name'), {
+      target: { value: 'speed' },
+    })
+    fireEvent.click(screen.getByText('Add'))
+
+    expect(onAdd).toHaveBeenCalledWith({
+      name: 'speed',
+      data_type: 'string',
+      is_required: false,
+      is_unique: false,
+    })
+  })
+
+  it('clicking edit on property calls onEditProperty', () => {
+    const onEdit = vi.fn()
+    const props = [makeProperty({ id: 'p1', name: 'color' })]
+    render(<ClassProperties properties={props} onEditProperty={onEdit} />)
+
+    fireEvent.click(screen.getByLabelText('Edit color'))
+    expect(onEdit).toHaveBeenCalledWith('p1')
+  })
+
+  it('clicking delete shows confirmation dialog', () => {
+    const props = [makeProperty({ id: 'p1', name: 'color' })]
+    render(<ClassProperties properties={props} />)
+
+    fireEvent.click(screen.getByLabelText('Delete color'))
+    expect(screen.getByText('Delete property')).toBeInTheDocument()
+    expect(screen.getByText(/Are you sure/)).toBeInTheDocument()
+  })
+
+  it('confirming delete calls onDeleteProperty', () => {
+    const onDelete = vi.fn()
+    const props = [makeProperty({ id: 'p1', name: 'color' })]
+    render(<ClassProperties properties={props} onDeleteProperty={onDelete} />)
+
+    fireEvent.click(screen.getByLabelText('Delete color'))
+    fireEvent.click(screen.getByText('Delete'))
+    expect(onDelete).toHaveBeenCalledWith('p1')
+  })
+})
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx
index 46c9ea5..9a6f430 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx
@@ -1,3 +1,196 @@
-export function ClassProperties() {
-  return <div>ClassProperties placeholder</div>
+import { useState } from 'react'
+import { Pencil, Trash2, Plus } from 'lucide-react'
+import { Button } from '@/components/ui/button'
+import { Input } from '@/components/ui/input'
+import { Badge } from '@/components/ui/badge'
+import {
+  AlertDialog,
+  AlertDialogAction,
+  AlertDialogCancel,
+  AlertDialogContent,
+  AlertDialogDescription,
+  AlertDialogFooter,
+  AlertDialogHeader,
+  AlertDialogTitle,
+  AlertDialogTrigger,
+} from '@/components/ui/alert-dialog'
+import type { Property } from '@/features/ontology/lib/api'
+
+interface ClassPropertiesProps {
+  properties: Property[]
+  onAddProperty?: (input: {
+    name: string
+    data_type: string
+    is_required: boolean
+    is_unique: boolean
+    description?: string
+  }) => void
+  onEditProperty?: (id: string) => void
+  onDeleteProperty?: (id: string) => void
+}
+
+const DATA_TYPES = ['string', 'integer', 'float', 'boolean', 'reference', 'json']
+
+export function ClassProperties({
+  properties,
+  onAddProperty,
+  onEditProperty,
+  onDeleteProperty,
+}: ClassPropertiesProps) {
+  const [showAddForm, setShowAddForm] = useState(false)
+  const [newName, setNewName] = useState('')
+  const [newType, setNewType] = useState('string')
+  const [newRequired, setNewRequired] = useState(false)
+  const [newUnique, setNewUnique] = useState(false)
+
+  const handleSubmitAdd = () => {
+    if (!newName.trim()) return
+    onAddProperty?.({
+      name: newName.trim(),
+      data_type: newType,
+      is_required: newRequired,
+      is_unique: newUnique,
+    })
+    setNewName('')
+    setNewType('string')
+    setNewRequired(false)
+    setNewUnique(false)
+    setShowAddForm(false)
+  }
+
+  return (
+    <div className="space-y-3">
+      <div className="flex items-center justify-between">
+        <h3 className="text-sm font-semibold">Properties</h3>
+        <Button
+          variant="outline"
+          size="sm"
+          onClick={() => setShowAddForm(!showAddForm)}
+        >
+          <Plus className="mr-1 h-3 w-3" />
+          Add Property
+        </Button>
+      </div>
+
+      {properties.length === 0 && !showAddForm && (
+        <p className="text-sm text-muted-foreground">No properties defined</p>
+      )}
+
+      <div className="space-y-1">
+        {properties.map((prop) => (
+          <div
+            key={prop.id}
+            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
+          >
+            <span className="min-w-0 truncate font-medium">{prop.name}</span>
+            <Badge variant="secondary" className="shrink-0 text-xs">
+              {prop.data_type}
+            </Badge>
+            {prop.is_required && (
+              <Badge variant="outline" className="shrink-0 text-xs">
+                Required
+              </Badge>
+            )}
+            {prop.is_unique && (
+              <Badge variant="outline" className="shrink-0 text-xs">
+                Unique
+              </Badge>
+            )}
+            <div className="ml-auto flex shrink-0 gap-1">
+              <Button
+                variant="ghost"
+                size="icon"
+                className="h-6 w-6"
+                onClick={() => onEditProperty?.(prop.id)}
+                aria-label={`Edit ${prop.name}`}
+              >
+                <Pencil className="h-3 w-3" />
+              </Button>
+              <AlertDialog>
+                <AlertDialogTrigger asChild>
+                  <Button
+                    variant="ghost"
+                    size="icon"
+                    className="h-6 w-6"
+                    aria-label={`Delete ${prop.name}`}
+                  >
+                    <Trash2 className="h-3 w-3" />
+                  </Button>
+                </AlertDialogTrigger>
+                <AlertDialogContent>
+                  <AlertDialogHeader>
+                    <AlertDialogTitle>Delete property</AlertDialogTitle>
+                    <AlertDialogDescription>
+                      Are you sure you want to delete &quot;{prop.name}&quot;? This
+                      action cannot be undone.
+                    </AlertDialogDescription>
+                  </AlertDialogHeader>
+                  <AlertDialogFooter>
+                    <AlertDialogCancel>Cancel</AlertDialogCancel>
+                    <AlertDialogAction
+                      onClick={() => onDeleteProperty?.(prop.id)}
+                    >
+                      Delete
+                    </AlertDialogAction>
+                  </AlertDialogFooter>
+                </AlertDialogContent>
+              </AlertDialog>
+            </div>
+          </div>
+        ))}
+      </div>
+
+      {showAddForm && (
+        <div className="space-y-2 rounded-md border p-3" data-testid="add-property-form">
+          <Input
+            placeholder="Property name"
+            value={newName}
+            onChange={(e) => setNewName(e.target.value)}
+          />
+          <select
+            value={newType}
+            onChange={(e) => setNewType(e.target.value)}
+            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
+            aria-label="Data type"
+          >
+            {DATA_TYPES.map((t) => (
+              <option key={t} value={t}>
+                {t}
+              </option>
+            ))}
+          </select>
+          <div className="flex gap-4">
+            <label className="flex items-center gap-1.5 text-sm">
+              <input
+                type="checkbox"
+                checked={newRequired}
+                onChange={(e) => setNewRequired(e.target.checked)}
+              />
+              Required
+            </label>
+            <label className="flex items-center gap-1.5 text-sm">
+              <input
+                type="checkbox"
+                checked={newUnique}
+                onChange={(e) => setNewUnique(e.target.checked)}
+              />
+              Unique
+            </label>
+          </div>
+          <div className="flex gap-2">
+            <Button size="sm" onClick={handleSubmitAdd}>
+              Add
+            </Button>
+            <Button
+              variant="outline"
+              size="sm"
+              onClick={() => setShowAddForm(false)}
+            >
+              Cancel
+            </Button>
+          </div>
+        </div>
+      )}
+    </div>
+  )
 }
diff --git a/frontend/src/features/ontology/components/shared/ClassLink.tsx b/frontend/src/features/ontology/components/shared/ClassLink.tsx
index 6425515..d991d70 100644
--- a/frontend/src/features/ontology/components/shared/ClassLink.tsx
+++ b/frontend/src/features/ontology/components/shared/ClassLink.tsx
@@ -1,3 +1,17 @@
-export function ClassLink() {
-  return <div>ClassLink placeholder</div>
+interface ClassLinkProps {
+  classId: string
+  className?: string
+  children: React.ReactNode
+}
+
+export function ClassLink({ classId, children }: ClassLinkProps) {
+  return (
+    <button
+      className="text-sm text-primary underline-offset-4 hover:underline"
+      data-testid="class-link"
+      data-class-id={classId}
+    >
+      {children}
+    </button>
+  )
 }
