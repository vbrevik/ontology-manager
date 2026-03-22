I now have all the context needed. Let me generate the section content.

# Section 07: Inline Editing

## Overview

This section implements the inline editing capabilities for the Ontology Browser: the reusable `EditableText` component (click-to-edit pattern), description editing mutation, property CRUD mutations with optimistic updates, a class creation dialog, and client-side validation. These editing features live in the detail panel (section-05) and tree panel header (section-04).

## Dependencies

- **section-03-layout-and-context**: Provides `OntologyBrowserContext` with `selectedClassId` and `setSelectedClassId`
- **section-04-tree-component**: The "New Class" button lives in the tree panel header area
- **section-05-detail-panel**: `ClassHeader` hosts the editable description; `ClassProperties` hosts property CRUD

## File Paths

New files to create:

- `frontend/src/features/ontology/components/shared/EditableText.tsx` -- Reusable click-to-edit component
- `frontend/src/features/ontology/components/shared/EditableText.test.tsx` -- Tests for EditableText
- `frontend/src/features/ontology/components/shared/CreateClassDialog.tsx` -- Class creation dialog
- `frontend/src/features/ontology/components/shared/CreateClassDialog.test.tsx` -- Tests for CreateClassDialog

Files to modify:

- `frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx` -- Wire up description editing with EditableText and mutation
- `frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx` -- Wire up property add/edit/delete with mutations
- `frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts` -- Add mutation functions for description update, property CRUD
- `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` -- Add "New Class" button that opens CreateClassDialog

---

## Tests (Write First)

### EditableText Tests (`frontend/src/features/ontology/components/shared/EditableText.test.tsx`)

Testing stack: Vitest + @testing-library/react + @testing-library/jest-dom. Test file lives alongside the component.

```tsx
/**
 * EditableText.test.tsx
 *
 * Tests for the reusable click-to-edit component.
 * Render with required props: value, onSave.
 * Optional props: multiline (boolean), loading (boolean).
 */

// Test: displays text in view mode
//   Render EditableText with value="Hello". Expect text "Hello" visible. No input/textarea present.

// Test: shows edit icon on hover
//   Render, hover over the component container. Expect a Pencil/edit icon to become visible.

// Test: clicking switches to edit mode with input/textarea
//   Render with value="Hello". Click the text element. Expect an input (or textarea if multiline) to appear with value "Hello".

// Test: input is auto-focused in edit mode
//   Click to enter edit mode. Expect the input element to have focus (document.activeElement).

// Test: pressing Enter saves (calls onSave callback)
//   Enter edit mode. Type "Updated". Press Enter. Expect onSave to be called with "Updated".

// Test: blur saves (calls onSave callback)
//   Enter edit mode. Type "Updated". Blur the input. Expect onSave called with "Updated".

// Test: pressing Escape cancels (reverts to original value)
//   Enter edit mode with value="Hello". Type "Changed". Press Escape. Expect display to show "Hello", onSave NOT called.

// Test: shows spinner during save (when loading prop is true)
//   Render with loading={true} while in edit mode. Expect a spinner/loading indicator visible.

// Test: input is disabled during save
//   Render with loading={true}. Expect the input element to have disabled attribute.
```

### CreateClassDialog Tests (`frontend/src/features/ontology/components/shared/CreateClassDialog.test.tsx`)

```tsx
/**
 * CreateClassDialog.test.tsx
 *
 * Tests for the class creation dialog.
 * The dialog is triggered by a button (trigger prop or built-in button).
 * Uses existing createClass() from api.ts and fetchCurrentVersion() for version_id.
 */

// Test: opens dialog on button click
//   Render the trigger button. Click it. Expect dialog content to appear with form fields.

// Test: requires class name (shows validation error if empty)
//   Open dialog. Leave name empty. Click submit. Expect validation error message visible. createClass NOT called.

// Test: submits with name, description, parent_class_id, is_abstract
//   Open dialog. Fill in name="MyClass", description="desc", select parent, toggle abstract.
//   Submit. Expect createClass called with { name: "MyClass", description: "desc", parent_class_id: <selected>, is_abstract: true, version_id: <from fetchCurrentVersion> }.

// Test: calls createClass on submit
//   Open dialog. Fill name. Submit. Expect the createClass API function to be called.

// Test: closes dialog on success
//   Mock createClass to resolve. Submit form. Expect dialog to close (dialog content no longer in DOM).

// Test: shows error toast on failure
//   Mock createClass to reject with Error("Server error"). Submit form. Expect toast to appear with error message.
```

---

## Implementation Details

### 1. EditableText Component

**File:** `frontend/src/features/ontology/components/shared/EditableText.tsx`

A reusable click-to-edit component used for the class description in `ClassHeader` and potentially for property inline editing.

**Props interface:**

```tsx
interface EditableTextProps {
  value: string
  onSave: (newValue: string) => void | Promise<void>
  multiline?: boolean       // if true, renders Textarea instead of Input
  loading?: boolean         // shows spinner, disables input during mutation
  placeholder?: string      // placeholder text when value is empty
  maxLength?: number        // client-side character limit
  className?: string
}
```

**Behavior:**

- **View mode (default):** Renders a `<span>` (or `<p>` if multiline) showing the current value. On hover, a small Pencil icon (from `lucide-react`) appears to indicate editability. Clicking anywhere on the text or icon transitions to edit mode.
- **Edit mode:** Replaces the text with a Shadcn `Input` (single line) or `Textarea` (multiline). The input is initialized with the current value and receives auto-focus. The original value is stored in a ref for cancellation.
- **Save:** On `Enter` key press (for single-line Input) or on blur, call `onSave(currentInputValue)`. If `onSave` returns a Promise, set internal loading state until it resolves. After save completes, return to view mode.
- **Cancel:** On `Escape` key press, revert the input value to the original and return to view mode without calling `onSave`.
- **Loading state:** When the `loading` prop is true (or internal loading state from async `onSave`), show a small `Loader2` spinner icon from lucide-react and set the input to `disabled`.
- Uses `cn()` utility from `@/lib/utils` for conditional class merging.

### 2. Class Description Editing Mutation

**File to modify:** `frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts`

Add a `useUpdateDescription` mutation (or include it as a return value from the `useClassDetail` hook). This mutation:

- Calls `updateClass(classId, { description: newDescription })` using the existing API function from `@/features/ontology/lib/api`
- Uses TanStack Query's `useMutation` with optimistic updates:
  - **`onMutate`:** Cancel any outgoing refetches for `['classes', 'detail', classId]`. Snapshot the previous class data from the query cache. Optimistically set the new description in the cache.
  - **`onError`:** Roll back to the snapshot.
  - **`onSettled`:** Invalidate both `['classes', 'list']` and `['classes', 'detail', classId]` queries to refetch fresh data.
- On error, show a toast notification using `useToast()` from `@/components/ui/use-toast` with `variant: 'destructive'` and the error message.

**File to modify:** `frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx`

Wire up the description field to use `EditableText`:
- Pass `multiline={true}` since descriptions can be multi-line
- Pass `maxLength={2000}` for client-side validation
- Pass the mutation's `isPending` state as the `loading` prop
- The `onSave` callback calls the description update mutation

Note: The class name remains read-only. The `UpdateClassInput` type only supports `description`, `parent_class_id`, and `is_abstract` -- not `name`.

### 3. Property CRUD Mutations

**File to modify:** `frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts`

Add three mutation hooks (returned from `useClassDetail` or as separate hooks):

**Create Property:**
- Calls `createProperty(input)` from `@/features/ontology/lib/api`
- The `CreatePropertyInput` requires `version_id` -- obtained from the `fetchCurrentVersion()` query already in `useClassDetail`
- Optimistic update: append the new property (with a temporary ID) to `['classes', classId, 'properties']` cache
- On success: invalidate `['classes', classId, 'properties']`
- On error: rollback + toast

**Update Property:**
- Calls `updateProperty(propertyId, input)` from `@/features/ontology/lib/api`
- `UpdatePropertyInput` supports: `description`, `data_type`, `is_required`, `is_unique`, `validation_rules`
- Optimistic update: modify the property in `['classes', classId, 'properties']` cache
- On error: rollback + toast

**Delete Property:**
- Calls `deleteProperty(propertyId)` from `@/features/ontology/lib/api`
- Before calling, show a Shadcn `AlertDialog` confirmation ("Are you sure you want to delete this property?")
- Optimistic update: remove the property from `['classes', classId, 'properties']` cache
- On error: rollback + toast

**File to modify:** `frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx`

Wire up the property list with mutation actions:
- "Add Property" button at the bottom opens an inline form row with fields for: name (required, max 255 chars), data_type (required, dropdown from valid types), description (optional), is_required (checkbox), is_unique (checkbox)
- Each property row has Edit and Delete action buttons (small icon buttons)
- Edit mode on a property row replaces the row content with inline inputs (same fields as add)
- Delete button triggers the `AlertDialog` confirmation before calling the delete mutation
- Input validation: name required (no empty string), data_type required from the valid set

### 4. Class Creation Dialog

**File:** `frontend/src/features/ontology/components/shared/CreateClassDialog.tsx`

A dialog for creating new ontology classes, triggered by a "New Class" button in the tree panel header.

**Props interface:**

```tsx
interface CreateClassDialogProps {
  trigger?: React.ReactNode  // custom trigger element, defaults to a Button
}
```

**Implementation details:**

- Uses Shadcn `Dialog` (DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter)
- Form fields:
  - **Name** (required): Shadcn `Input`, max 255 characters, validated non-empty on submit
  - **Description** (optional): Shadcn `Textarea`
  - **Parent Class** (optional): Shadcn `Select` or `Combobox` populated from the class list (fetched via `['classes', 'list']` query cache or a fresh `fetchClasses()` call)
  - **Abstract** (boolean): Shadcn `Switch` or `Checkbox`, defaults to false
- On submit:
  - Validate: name must be non-empty after trimming
  - Fetch current version via `fetchCurrentVersion()` (or use cached value from `['ontology-versions', 'current']`)
  - Call `createClass({ name, description, parent_class_id, is_abstract, version_id })`
  - On success: close dialog, invalidate `['classes', 'list']`, set the new class as `selectedClassId` in OntologyBrowserContext
  - On error: show a toast with `variant: 'destructive'` and the error message, keep dialog open
- Uses `useMutation` from TanStack Query
- Controlled form state with `useState` (no form library needed -- simple single-form mutation)

**File to modify:** `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx`

Add a "New Class" button (e.g., a `Button` with `variant="outline"` and a Plus icon) in the header area of the tree panel, above the search bar. This button renders `CreateClassDialog` as its child.

### 5. Validation Rules

Client-side validation using controlled React state (no form library -- the edits are simple single-field mutations):

| Field | Rule | Error Message |
|-------|------|---------------|
| Class description | Optional, max 2000 characters | "Description must be 2000 characters or fewer" |
| Property name | Required, max 255 characters, no empty/whitespace-only | "Property name is required" |
| Property data_type | Required, must be from valid type set | "Property type is required" |
| New class name | Required, max 255 characters, no empty/whitespace-only | "Class name is required" |

Server-side validation is handled by the existing backend. On server error, show a toast notification using the existing toast system (`useToast` from `@/components/ui/use-toast`) with the error message and rollback the optimistic update.

### 6. Security Notes

- All rendered content uses React's default JSX escaping -- no `dangerouslySetInnerHTML` or raw HTML rendering
- All mutations use existing API functions from `@/features/ontology/lib/api` which go through the backend's CSRF and auth middleware
- Input validation enforces length limits before submission to prevent excessively large payloads

### 7. Existing API Functions Reference

All editing operations use functions already defined in `frontend/src/features/ontology/lib/api.ts`:

- `updateClass(id: string, input: UpdateClassInput): Promise<Class>` -- PUT `/api/ontology/classes/{id}`, accepts `{ description?, parent_class_id?, is_abstract? }`
- `createClass(input: CreateClassInput): Promise<Class>` -- POST `/api/ontology/classes`, accepts `{ name, description?, parent_class_id?, version_id, is_abstract? }`
- `createProperty(input: CreatePropertyInput): Promise<Property>` -- POST `/api/ontology/properties`, accepts `{ name, description?, class_id, data_type, is_required?, is_unique?, version_id, validation_rules? }`
- `updateProperty(id: string, input: UpdatePropertyInput): Promise<Property>` -- PUT `/api/ontology/properties/{id}`, accepts `{ description?, data_type?, is_required?, is_unique?, validation_rules? }`
- `deleteProperty(id: string): Promise<void>` -- DELETE `/api/ontology/properties/{id}`
- `fetchCurrentVersion(): Promise<OntologyVersion>` -- GET `/api/ontology/versions/current`

### 8. Query Key Strategy for Cache Invalidation

When mutations succeed or settle, invalidate these query keys:

- Description update: invalidate `['classes', 'list']` and `['classes', 'detail', classId]`
- Property create/update/delete: invalidate `['classes', classId, 'properties']`
- Class creation: invalidate `['classes', 'list']`

### 9. Optimistic Update Pattern

All mutations follow this TanStack Query optimistic update pattern:

```tsx
useMutation({
  mutationFn: (args) => apiCall(args),
  onMutate: async (args) => {
    // 1. Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: [...] })
    // 2. Snapshot previous data
    const previous = queryClient.getQueryData([...])
    // 3. Optimistically update cache
    queryClient.setQueryData([...], (old) => /* apply optimistic change */)
    // 4. Return snapshot for rollback
    return { previous }
  },
  onError: (err, args, context) => {
    // Rollback to snapshot
    queryClient.setQueryData([...], context?.previous)
    // Show error toast
    toast({ title: "Error", description: err.message, variant: "destructive" })
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: [...] })
  },
})
```