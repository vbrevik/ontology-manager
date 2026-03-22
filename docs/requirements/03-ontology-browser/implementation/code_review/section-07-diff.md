diff --git a/docs/requirements/03-ontology-browser/implementation/deep_implement_config.json b/docs/requirements/03-ontology-browser/implementation/deep_implement_config.json
index b88b96d..639abee 100644
--- a/docs/requirements/03-ontology-browser/implementation/deep_implement_config.json
+++ b/docs/requirements/03-ontology-browser/implementation/deep_implement_config.json
@@ -37,6 +37,10 @@
     "section-05-detail-panel": {
       "status": "complete",
       "commit_hash": "63b8825"
+    },
+    "section-06-shared-components": {
+      "status": "complete",
+      "commit_hash": "bc273fc"
     }
   },
   "pre_commit": {
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
index a221c30..2ea9578 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
@@ -29,6 +29,7 @@ export function ClassDetail() {
     currentVersion,
     isLoading,
     isPlaceholderData,
+    isDescriptionSaving,
     updateDescription,
     createProperty,
     deleteProperty,
@@ -66,6 +67,7 @@ export function ClassDetail() {
           parentClassName={parentClass?.name}
           onDescriptionSave={updateDescription}
           onNavigate={setSelectedClassId}
+          isDescriptionSaving={isDescriptionSaving}
         />
 
         <ClassProperties
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
index 5cd1aae..7bcedc8 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
@@ -1,7 +1,7 @@
-import { useState } from 'react'
 import type { Class } from '@/features/ontology/lib/api'
 import { SourceBadge } from '../shared/SourceBadge'
 import { ClassLink } from '../shared/ClassLink'
+import { EditableText } from '../shared/EditableText'
 
 interface ClassHeaderProps {
   classData: Class
@@ -9,6 +9,7 @@ interface ClassHeaderProps {
   onDescriptionSave?: (description: string) => void
   onNavigate?: (classId: string) => void
   onSourceClick?: (sourceId: string) => void
+  isDescriptionSaving?: boolean
 }
 
 export function ClassHeader({
@@ -17,27 +18,12 @@ export function ClassHeader({
   onDescriptionSave,
   onNavigate,
   onSourceClick,
+  isDescriptionSaving,
 }: ClassHeaderProps) {
-  const [isEditing, setIsEditing] = useState(false)
-  const [editValue, setEditValue] = useState('')
-
   const sourceId = 'source_id' in classData
     ? (classData as Class & { source_id?: string }).source_id
     : undefined
 
-  const handleDescriptionClick = () => {
-    if (!classData.description) return
-    setEditValue(classData.description)
-    setIsEditing(true)
-  }
-
-  const handleSave = () => {
-    setIsEditing(false)
-    if (editValue !== classData.description) {
-      onDescriptionSave?.(editValue)
-    }
-  }
-
   return (
     <div className="space-y-3">
       <div className="flex items-center gap-3">
@@ -52,33 +38,15 @@ export function ClassHeader({
         </div>
       )}
 
-      {classData.description && !isEditing && (
-        <p
-          className="cursor-pointer text-sm text-muted-foreground hover:bg-muted/50 rounded px-1 -mx-1"
-          onClick={handleDescriptionClick}
-        >
-          {classData.description}
-        </p>
-      )}
-
-      {isEditing && (
-        <textarea
-          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
-          value={editValue}
-          onChange={(e) => setEditValue(e.target.value)}
-          onBlur={handleSave}
-          onKeyDown={(e) => {
-            if (e.key === 'Enter' && !e.shiftKey) {
-              e.preventDefault()
-              handleSave()
-            }
-            if (e.key === 'Escape') {
-              setIsEditing(false)
-            }
-          }}
-          autoFocus
-        />
-      )}
+      <EditableText
+        value={classData.description ?? ''}
+        onSave={(newDesc) => onDescriptionSave?.(newDesc)}
+        multiline
+        maxLength={2000}
+        loading={isDescriptionSaving}
+        placeholder="Add a description..."
+        className="text-muted-foreground"
+      />
     </div>
   )
 }
diff --git a/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts b/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
index 70d2c5e..5a91146 100644
--- a/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
+++ b/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
@@ -22,6 +22,7 @@ export interface UseClassDetailReturn {
   currentVersion: OntologyVersion | undefined
   isLoading: boolean
   isPlaceholderData: boolean
+  isDescriptionSaving: boolean
   error: Error | null
   updateDescription: (description: string) => Promise<void>
   createProperty: (
@@ -58,11 +59,22 @@ export function useClassDetail(classId: string | null): UseClassDetailReturn {
   const descriptionMutation = useMutation({
     mutationFn: (description: string) =>
       updateClass(classId!, { description }),
+    onMutate: async (description) => {
+      await queryClient.cancelQueries({ queryKey: ['classes', 'detail', classId] })
+      const previous = queryClient.getQueryData<Class>(['classes', 'detail', classId])
+      queryClient.setQueryData<Class>(['classes', 'detail', classId], (old) =>
+        old ? { ...old, description } : old,
+      )
+      return { previous }
+    },
+    onError: (_err, _desc, context) => {
+      if (context?.previous) {
+        queryClient.setQueryData(['classes', 'detail', classId], context.previous)
+      }
+    },
     onSettled: () => {
       queryClient.invalidateQueries({ queryKey: ['classes', 'list'] })
-      queryClient.invalidateQueries({
-        queryKey: ['classes', 'detail', classId],
-      })
+      queryClient.invalidateQueries({ queryKey: ['classes', 'detail', classId] })
     },
   })
 
@@ -77,29 +89,72 @@ export function useClassDetail(classId: string | null): UseClassDetailReturn {
         version_id: versionQuery.data.id,
       })
     },
+    onMutate: async (input) => {
+      await queryClient.cancelQueries({ queryKey: ['classes', classId, 'properties'] })
+      const previous = queryClient.getQueryData<Property[]>(['classes', classId, 'properties'])
+      const tempProperty: Property = {
+        id: `temp-${Date.now()}`,
+        name: input.name,
+        class_id: classId!,
+        data_type: input.data_type,
+        is_required: input.is_required ?? false,
+        is_unique: input.is_unique ?? false,
+        version_id: versionQuery.data?.id ?? '',
+        validation_rules: input.validation_rules ?? null,
+      }
+      queryClient.setQueryData<Property[]>(['classes', classId, 'properties'], (old) =>
+        old ? [...old, tempProperty] : [tempProperty],
+      )
+      return { previous }
+    },
+    onError: (_err, _input, context) => {
+      if (context?.previous) {
+        queryClient.setQueryData(['classes', classId, 'properties'], context.previous)
+      }
+    },
     onSettled: () => {
-      queryClient.invalidateQueries({
-        queryKey: ['classes', classId, 'properties'],
-      })
+      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'properties'] })
     },
   })
 
   const updatePropertyMutation = useMutation({
     mutationFn: ({ id, input }: { id: string; input: UpdatePropertyInput }) =>
       apiUpdateProperty(id, input),
+    onMutate: async ({ id, input }) => {
+      await queryClient.cancelQueries({ queryKey: ['classes', classId, 'properties'] })
+      const previous = queryClient.getQueryData<Property[]>(['classes', classId, 'properties'])
+      queryClient.setQueryData<Property[]>(['classes', classId, 'properties'], (old) =>
+        old?.map((p) => (p.id === id ? { ...p, ...input } : p)),
+      )
+      return { previous }
+    },
+    onError: (_err, _vars, context) => {
+      if (context?.previous) {
+        queryClient.setQueryData(['classes', classId, 'properties'], context.previous)
+      }
+    },
     onSettled: () => {
-      queryClient.invalidateQueries({
-        queryKey: ['classes', classId, 'properties'],
-      })
+      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'properties'] })
     },
   })
 
   const deletePropertyMutation = useMutation({
     mutationFn: (id: string) => apiDeleteProperty(id),
+    onMutate: async (id) => {
+      await queryClient.cancelQueries({ queryKey: ['classes', classId, 'properties'] })
+      const previous = queryClient.getQueryData<Property[]>(['classes', classId, 'properties'])
+      queryClient.setQueryData<Property[]>(['classes', classId, 'properties'], (old) =>
+        old?.filter((p) => p.id !== id),
+      )
+      return { previous }
+    },
+    onError: (_err, _id, context) => {
+      if (context?.previous) {
+        queryClient.setQueryData(['classes', classId, 'properties'], context.previous)
+      }
+    },
     onSettled: () => {
-      queryClient.invalidateQueries({
-        queryKey: ['classes', classId, 'properties'],
-      })
+      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'properties'] })
     },
   })
 
@@ -107,8 +162,6 @@ export function useClassDetail(classId: string | null): UseClassDetailReturn {
     classQuery.isLoading || propertiesQuery.isLoading || versionQuery.isLoading
   const isPlaceholderData =
     classQuery.isPlaceholderData || propertiesQuery.isPlaceholderData
-  // TanStack Query types error as Error | null but the generic is unknown —
-  // cast is safe because our queryFn throws Error instances
   const error =
     (classQuery.error as Error | null) ??
     (propertiesQuery.error as Error | null) ??
@@ -120,6 +173,7 @@ export function useClassDetail(classId: string | null): UseClassDetailReturn {
     currentVersion: versionQuery.data,
     isLoading,
     isPlaceholderData,
+    isDescriptionSaving: descriptionMutation.isPending,
     error,
     updateDescription: async (description: string) => {
       await descriptionMutation.mutateAsync(description)
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx
index 71f19a5..5408d37 100644
--- a/frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx
@@ -124,6 +124,9 @@ vi.mock('../shared/SourceBadge', () => ({
 vi.mock('../shared/ConflictBadge', () => ({
   ConflictBadge: () => <span data-testid="conflict-badge" />,
 }))
+vi.mock('../shared/CreateClassDialog', () => ({
+  CreateClassDialog: () => <button data-testid="create-class-dialog">New Class</button>,
+}))
 
 import { ClassTree } from './ClassTree'
 
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
index 4531818..92fb941 100644
--- a/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
@@ -12,6 +12,7 @@ import { useOntologyBrowser } from '../OntologyBrowserContext'
 import { useClassTree } from './useClassTree'
 import { ClassTreeSearch } from './ClassTreeSearch'
 import { ClassTreeNode, type ClassNodeData } from './ClassTreeNode'
+import { CreateClassDialog } from '../shared/CreateClassDialog'
 
 function classToNodeData(cls: Class): ClassNodeData {
   return {
@@ -98,6 +99,10 @@ export function ClassTree() {
 
   return (
     <div className="flex h-full flex-col" data-testid="class-tree">
+      <div className="flex items-center justify-between px-2 py-1.5">
+        <span className="text-sm font-semibold">Classes</span>
+        <CreateClassDialog />
+      </div>
       <ClassTreeSearch
         searchText={searchText}
         onSearchChange={setSearchText}
diff --git a/frontend/src/features/ontology/components/shared/CreateClassDialog.test.tsx b/frontend/src/features/ontology/components/shared/CreateClassDialog.test.tsx
new file mode 100644
index 0000000..881c68e
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/CreateClassDialog.test.tsx
@@ -0,0 +1,86 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { render, screen, waitFor } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
+import { CreateClassDialog } from './CreateClassDialog'
+
+const mockCreateClass = vi.fn()
+const mockFetchCurrentVersion = vi.fn()
+
+vi.mock('@/features/ontology/lib/api', () => ({
+  createClass: (...args: unknown[]) => mockCreateClass(...args),
+  fetchCurrentVersion: () => mockFetchCurrentVersion(),
+  fetchClasses: () => Promise.resolve([]),
+}))
+
+vi.mock('../OntologyBrowserContext', () => ({
+  useOntologyBrowser: () => ({
+    setSelectedClassId: vi.fn(),
+  }),
+}))
+
+function renderWithProviders(ui: React.ReactElement) {
+  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
+  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
+}
+
+describe('CreateClassDialog', () => {
+  beforeEach(() => {
+    vi.clearAllMocks()
+    mockFetchCurrentVersion.mockResolvedValue({ id: 'v1', name: 'v1' })
+  })
+
+  it('opens dialog on button click', async () => {
+    const user = userEvent.setup()
+    renderWithProviders(<CreateClassDialog />)
+    await user.click(screen.getByRole('button', { name: /new class/i }))
+    expect(screen.getByText('Create New Class')).toBeInTheDocument()
+  })
+
+  it('requires class name', async () => {
+    const user = userEvent.setup()
+    renderWithProviders(<CreateClassDialog />)
+    await user.click(screen.getByRole('button', { name: /new class/i }))
+    await user.click(screen.getByRole('button', { name: /create/i }))
+    expect(screen.getByText('Class name is required')).toBeInTheDocument()
+    expect(mockCreateClass).not.toHaveBeenCalled()
+  })
+
+  it('submits with name and calls createClass', async () => {
+    mockCreateClass.mockResolvedValue({ id: 'new-1', name: 'MyClass' })
+    const user = userEvent.setup()
+    renderWithProviders(<CreateClassDialog />)
+    await user.click(screen.getByRole('button', { name: /new class/i }))
+    await user.type(screen.getByPlaceholderText('Class name'), 'MyClass')
+    await user.click(screen.getByRole('button', { name: /create/i }))
+    await waitFor(() => {
+      expect(mockCreateClass).toHaveBeenCalledWith(
+        expect.objectContaining({ name: 'MyClass', version_id: 'v1' }),
+      )
+    })
+  })
+
+  it('closes dialog on success', async () => {
+    mockCreateClass.mockResolvedValue({ id: 'new-1', name: 'MyClass' })
+    const user = userEvent.setup()
+    renderWithProviders(<CreateClassDialog />)
+    await user.click(screen.getByRole('button', { name: /new class/i }))
+    await user.type(screen.getByPlaceholderText('Class name'), 'MyClass')
+    await user.click(screen.getByRole('button', { name: /create/i }))
+    await waitFor(() => {
+      expect(screen.queryByText('Create New Class')).not.toBeInTheDocument()
+    })
+  })
+
+  it('shows error on failure', async () => {
+    mockCreateClass.mockRejectedValue(new Error('Server error'))
+    const user = userEvent.setup()
+    renderWithProviders(<CreateClassDialog />)
+    await user.click(screen.getByRole('button', { name: /new class/i }))
+    await user.type(screen.getByPlaceholderText('Class name'), 'MyClass')
+    await user.click(screen.getByRole('button', { name: /create/i }))
+    await waitFor(() => {
+      expect(screen.getByText(/server error/i)).toBeInTheDocument()
+    })
+  })
+})
diff --git a/frontend/src/features/ontology/components/shared/CreateClassDialog.tsx b/frontend/src/features/ontology/components/shared/CreateClassDialog.tsx
new file mode 100644
index 0000000..5592fdf
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/CreateClassDialog.tsx
@@ -0,0 +1,132 @@
+import { useState } from 'react'
+import { Plus } from 'lucide-react'
+import { useMutation, useQueryClient } from '@tanstack/react-query'
+import { Button } from '@/components/ui/button'
+import {
+  Dialog,
+  DialogContent,
+  DialogHeader,
+  DialogTitle,
+  DialogFooter,
+} from '@/components/ui/dialog'
+import { Input } from '@/components/ui/input'
+import { Textarea } from '@/components/ui/textarea'
+import { createClass, fetchCurrentVersion } from '@/features/ontology/lib/api'
+import { useOntologyBrowser } from '../OntologyBrowserContext'
+
+interface CreateClassDialogProps {
+  trigger?: React.ReactNode
+}
+
+export function CreateClassDialog({ trigger }: CreateClassDialogProps) {
+  const [open, setOpen] = useState(false)
+  const [name, setName] = useState('')
+  const [description, setDescription] = useState('')
+  const [isAbstract, setIsAbstract] = useState(false)
+  const [validationError, setValidationError] = useState('')
+  const [submitError, setSubmitError] = useState('')
+  const queryClient = useQueryClient()
+  const { setSelectedClassId } = useOntologyBrowser()
+
+  const mutation = useMutation({
+    mutationFn: async () => {
+      const version = await fetchCurrentVersion()
+      return createClass({
+        name: name.trim(),
+        description: description.trim() || undefined,
+        is_abstract: isAbstract,
+        version_id: version.id,
+      })
+    },
+    onSuccess: (newClass) => {
+      queryClient.invalidateQueries({ queryKey: ['classes', 'list'] })
+      setSelectedClassId(newClass.id)
+      resetForm()
+      setOpen(false)
+    },
+    onError: (err: Error) => {
+      setSubmitError(err.message)
+    },
+  })
+
+  const resetForm = () => {
+    setName('')
+    setDescription('')
+    setIsAbstract(false)
+    setValidationError('')
+    setSubmitError('')
+  }
+
+  const handleSubmit = () => {
+    setValidationError('')
+    setSubmitError('')
+    if (!name.trim()) {
+      setValidationError('Class name is required')
+      return
+    }
+    mutation.mutate()
+  }
+
+  const handleOpen = () => {
+    resetForm()
+    setOpen(true)
+  }
+
+  return (
+    <>
+      {trigger ? (
+        <span onClick={handleOpen}>{trigger}</span>
+      ) : (
+        <Button variant="outline" size="sm" aria-label="New class" onClick={handleOpen}>
+          <Plus className="mr-1 h-3 w-3" />
+          New Class
+        </Button>
+      )}
+      <Dialog open={open}>
+        <DialogContent>
+          <DialogHeader>
+            <DialogTitle>Create New Class</DialogTitle>
+          </DialogHeader>
+          <div className="space-y-3 py-2">
+            <div>
+              <Input
+                placeholder="Class name"
+                value={name}
+                onChange={(e) => setName(e.target.value)}
+                maxLength={255}
+              />
+              {validationError && (
+                <p className="mt-1 text-sm text-destructive">{validationError}</p>
+              )}
+            </div>
+            <Textarea
+              placeholder="Description (optional)"
+              value={description}
+              onChange={(e) => setDescription(e.target.value)}
+              maxLength={2000}
+            />
+            <label className="flex items-center gap-2 text-sm">
+              <input
+                type="checkbox"
+                checked={isAbstract}
+                onChange={(e) => setIsAbstract(e.target.checked)}
+              />
+              Abstract class
+            </label>
+            {submitError && (
+              <p className="text-sm text-destructive">{submitError}</p>
+            )}
+          </div>
+          <DialogFooter>
+            <Button variant="outline" onClick={() => setOpen(false)}>
+              Cancel
+            </Button>
+            <Button onClick={handleSubmit} disabled={mutation.isPending} aria-label="Create">
+              {mutation.isPending ? 'Creating...' : 'Create'}
+            </Button>
+          </DialogFooter>
+        </DialogContent>
+      </Dialog>
+    </>
+  )
+}
diff --git a/frontend/src/features/ontology/components/shared/EditableText.test.tsx b/frontend/src/features/ontology/components/shared/EditableText.test.tsx
new file mode 100644
index 0000000..8e55b44
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/EditableText.test.tsx
@@ -0,0 +1,82 @@
+import { describe, it, expect, vi } from 'vitest'
+import { render, screen, fireEvent } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { EditableText } from './EditableText'
+
+describe('EditableText', () => {
+  it('displays text in view mode', () => {
+    render(<EditableText value="Hello" onSave={vi.fn()} />)
+    expect(screen.getByText('Hello')).toBeInTheDocument()
+    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
+  })
+
+  it('shows edit icon on hover', async () => {
+    const user = userEvent.setup()
+    render(<EditableText value="Hello" onSave={vi.fn()} />)
+    await user.hover(screen.getByText('Hello'))
+    expect(screen.getByTestId('editable-text-icon')).toBeInTheDocument()
+  })
+
+  it('clicking switches to edit mode with input', async () => {
+    const user = userEvent.setup()
+    render(<EditableText value="Hello" onSave={vi.fn()} />)
+    await user.click(screen.getByText('Hello'))
+    const input = screen.getByRole('textbox')
+    expect(input).toBeInTheDocument()
+    expect(input).toHaveValue('Hello')
+  })
+
+  it('input is auto-focused in edit mode', async () => {
+    const user = userEvent.setup()
+    render(<EditableText value="Hello" onSave={vi.fn()} />)
+    await user.click(screen.getByText('Hello'))
+    expect(screen.getByRole('textbox')).toHaveFocus()
+  })
+
+  it('pressing Enter saves', async () => {
+    const onSave = vi.fn()
+    const user = userEvent.setup()
+    render(<EditableText value="Hello" onSave={onSave} />)
+    await user.click(screen.getByText('Hello'))
+    await user.clear(screen.getByRole('textbox'))
+    await user.type(screen.getByRole('textbox'), 'Updated{Enter}')
+    expect(onSave).toHaveBeenCalledWith('Updated')
+  })
+
+  it('blur saves', async () => {
+    const onSave = vi.fn()
+    const user = userEvent.setup()
+    render(<EditableText value="Hello" onSave={onSave} />)
+    await user.click(screen.getByText('Hello'))
+    await user.clear(screen.getByRole('textbox'))
+    await user.type(screen.getByRole('textbox'), 'Updated')
+    await user.tab()
+    expect(onSave).toHaveBeenCalledWith('Updated')
+  })
+
+  it('pressing Escape cancels without saving', async () => {
+    const onSave = vi.fn()
+    const user = userEvent.setup()
+    render(<EditableText value="Hello" onSave={onSave} />)
+    await user.click(screen.getByText('Hello'))
+    await user.clear(screen.getByRole('textbox'))
+    await user.type(screen.getByRole('textbox'), 'Changed')
+    await user.keyboard('{Escape}')
+    expect(onSave).not.toHaveBeenCalled()
+    expect(screen.getByText('Hello')).toBeInTheDocument()
+  })
+
+  it('renders textarea when multiline is true', async () => {
+    const user = userEvent.setup()
+    render(<EditableText value="Hello" onSave={vi.fn()} multiline />)
+    await user.click(screen.getByText('Hello'))
+    const textarea = screen.getByRole('textbox')
+    expect(textarea.tagName).toBe('TEXTAREA')
+  })
+
+  it('input is disabled during loading', () => {
+    render(<EditableText value="Hello" onSave={vi.fn()} loading />)
+    // When loading, show the value with a spinner, no edit mode
+    expect(screen.getByTestId('editable-text-spinner')).toBeInTheDocument()
+  })
+})
diff --git a/frontend/src/features/ontology/components/shared/EditableText.tsx b/frontend/src/features/ontology/components/shared/EditableText.tsx
new file mode 100644
index 0000000..d16c9dc
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/EditableText.tsx
@@ -0,0 +1,107 @@
+import { useState, useRef, useEffect } from 'react'
+import { Pencil, Loader2 } from 'lucide-react'
+import { Input } from '@/components/ui/input'
+import { Textarea } from '@/components/ui/textarea'
+import { cn } from '@/lib/utils'
+
+interface EditableTextProps {
+  value: string
+  onSave: (newValue: string) => void | Promise<void>
+  multiline?: boolean
+  loading?: boolean
+  placeholder?: string
+  maxLength?: number
+  className?: string
+}
+
+export function EditableText({
+  value,
+  onSave,
+  multiline = false,
+  loading = false,
+  placeholder = 'Click to edit...',
+  maxLength,
+  className,
+}: EditableTextProps) {
+  const [isEditing, setIsEditing] = useState(false)
+  const [editValue, setEditValue] = useState(value)
+  const [isHovered, setIsHovered] = useState(false)
+  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
+
+  useEffect(() => {
+    if (isEditing && inputRef.current) {
+      inputRef.current.focus()
+    }
+  }, [isEditing])
+
+  const handleStartEdit = () => {
+    if (loading) return
+    setEditValue(value)
+    setIsEditing(true)
+  }
+
+  const handleSave = () => {
+    setIsEditing(false)
+    if (editValue !== value) {
+      onSave(editValue)
+    }
+  }
+
+  const handleCancel = () => {
+    setIsEditing(false)
+    setEditValue(value)
+  }
+
+  const handleKeyDown = (e: React.KeyboardEvent) => {
+    if (e.key === 'Escape') {
+      handleCancel()
+    }
+    if (e.key === 'Enter' && !multiline) {
+      e.preventDefault()
+      handleSave()
+    }
+  }
+
+  if (loading) {
+    return (
+      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
+        <span>{value || placeholder}</span>
+        <Loader2 className="h-3 w-3 animate-spin" data-testid="editable-text-spinner" />
+      </div>
+    )
+  }
+
+  if (isEditing) {
+    const InputComponent = multiline ? Textarea : Input
+    return (
+      <InputComponent
+        ref={inputRef as any}
+        value={editValue}
+        onChange={(e) => setEditValue(e.target.value)}
+        onBlur={handleSave}
+        onKeyDown={handleKeyDown}
+        maxLength={maxLength}
+        className={cn('text-sm', className)}
+      />
+    )
+  }
+
+  return (
+    <div
+      className={cn(
+        'group flex cursor-pointer items-center gap-1 rounded px-1 -mx-1 text-sm hover:bg-muted/50',
+        className,
+      )}
+      onClick={handleStartEdit}
+      onMouseEnter={() => setIsHovered(true)}
+      onMouseLeave={() => setIsHovered(false)}
+    >
+      <span className={cn(!value && 'text-muted-foreground')}>
+        {value || placeholder}
+      </span>
+      {isHovered && (
+        <Pencil className="h-3 w-3 text-muted-foreground" data-testid="editable-text-icon" />
+      )}
+    </div>
+  )
+}
