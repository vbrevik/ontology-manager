Now I have all the context needed. Let me generate the section content.

# Section 05: Detail Panel

## Overview

This section implements the right-side detail panel of the Ontology Browser. When a class is selected in the tree (section-04), the detail panel displays the class header (name, parent link, source badge, description), a properties list, and optional conflict information. The detail panel fetches its own data via the `useClassDetail` hook (section-02) and reads the selected class ID from `OntologyBrowserContext` (section-03).

**Files to create:**
- `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx`
- `frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx`
- `frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx`
- `frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx`
- `frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx`
- `frontend/src/features/ontology/components/ClassDetail/ClassProperties.test.tsx`
- `frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx`
- `frontend/src/features/ontology/components/ClassDetail/ClassConflicts.test.tsx`

**Dependencies (must be completed first):**
- **section-02-data-layer**: Provides the `useClassDetail` hook that fetches class detail, properties, and current version
- **section-03-layout-and-context**: Provides `OntologyBrowserContext` with `selectedClassId` and `setSelectedClassId`
- **section-06-shared-components**: Provides `SourceBadge`, `ConflictBadge`, and `ClassLink` components

---

## Key Data Types

These types are defined in `frontend/src/features/ontology/lib/api.ts` and are used throughout the detail panel:

```typescript
interface Class {
  id: string;
  name: string;
  description?: string;
  parent_class_id?: string;
  version_id: string;
  is_abstract: boolean;
  attributes: Record<string, any>;
  created_at: string;
}

interface Property {
  id: string;
  name: string;
  description?: string;
  class_id: string;
  data_type: string;
  is_required: boolean;
  is_unique: boolean;
  version_id: string;
  validation_rules: any;
}

interface UpdateClassInput {
  description?: string;
  parent_class_id?: string;
  is_abstract?: boolean;
}
```

The `UpdateClassInput` does NOT support name changes -- class name is always read-only.

---

## Tests

Tests use Vitest + @testing-library/react + @testing-library/jest-dom. Test files live alongside source files. Mock the `useClassDetail` hook and `OntologyBrowserContext` as needed.

### ClassDetail Tests (`ClassDetail.test.tsx`)

```typescript
/**
 * File: frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx
 *
 * Test: shows "Select a class" placeholder when no class selected
 *   - Render ClassDetail with selectedClassId = null in context
 *   - Expect placeholder text "Select a class" (or similar) to be visible
 *
 * Test: renders ClassHeader, ClassProperties when class selected
 *   - Render ClassDetail with a valid selectedClassId in context
 *   - Mock useClassDetail to return class data and properties
 *   - Expect ClassHeader content (class name) to be visible
 *   - Expect ClassProperties content to be visible
 *
 * Test: renders ClassConflicts only when conflict data present
 *   - Mock useClassDetail to return class data that includes conflict information
 *   - Expect conflict section to be rendered
 *
 * Test: does not render ClassConflicts when no conflict data
 *   - Mock useClassDetail to return class data without conflict information
 *   - Expect conflict section NOT to be in the document
 *
 * Test: shows loading skeleton while data is loading
 *   - Mock useClassDetail with isLoading = true
 *   - Expect skeleton elements to be visible (not a spinner)
 */
```

### ClassHeader Tests (`ClassHeader.test.tsx`)

```typescript
/**
 * File: frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx
 *
 * Test: renders class name as read-only text (not editable)
 *   - Pass a class object with name "Vehicle"
 *   - Expect "Vehicle" text to be visible
 *   - Expect no input/textarea for the name field
 *
 * Test: renders parent class as clickable ClassLink
 *   - Pass a class with parent_class_id set, and a parentClassName prop
 *   - Expect ClassLink to be rendered with the parent class name
 *
 * Test: renders SourceBadge when source_id present
 *   - Pass a class with source_id defined (on the class data object)
 *   - Expect SourceBadge component to be rendered
 *
 * Test: hides SourceBadge when source_id absent
 *   - Pass a class without source_id
 *   - Expect SourceBadge NOT to be in the document
 *
 * Test: renders description text
 *   - Pass a class with description "A motorized vehicle"
 *   - Expect the description text to be visible
 *
 * Test: clicking description enters edit mode
 *   - Click on the description text
 *   - Expect a textarea or input to appear (edit mode)
 *   - NOTE: The actual editing mutation is handled by section-07 (inline editing).
 *     This test only verifies the click-to-edit transition.
 *
 * Test: saving description calls updateClass mutation
 *   - Enter edit mode, type new description, trigger save (blur or Enter)
 *   - Expect the onDescriptionSave callback (or mutation) to be called with new text
 *   - NOTE: Full mutation wiring is section-07 scope. This test can verify the
 *     callback prop is invoked.
 */
```

### ClassProperties Tests (`ClassProperties.test.tsx`)

```typescript
/**
 * File: frontend/src/features/ontology/components/ClassDetail/ClassProperties.test.tsx
 *
 * Test: renders property list with name, type, constraints
 *   - Pass an array of Property objects
 *   - Expect each property name, data_type, and constraint indicators to be visible
 *
 * Test: renders "Add Property" button
 *   - Render ClassProperties
 *   - Expect a button with text "Add Property" to be visible
 *
 * Test: clicking Add opens inline form
 *   - Click the "Add Property" button
 *   - Expect form inputs for property name, type, etc. to appear
 *
 * Test: submitting add form calls createProperty with version_id
 *   - Fill in property form fields, submit
 *   - Expect the onAddProperty callback to be called with correct payload
 *     including version_id
 *
 * Test: clicking edit on property enters edit mode
 *   - Click the edit button/icon on a property row
 *   - Expect that property's fields to become editable
 *
 * Test: clicking delete shows confirmation dialog
 *   - Click the delete button/icon on a property row
 *   - Expect a confirmation dialog (AlertDialog) to appear
 *
 * Test: confirming delete calls deleteProperty
 *   - Click delete, then confirm in the dialog
 *   - Expect the onDeleteProperty callback to be called with the property id
 */
```

### ClassConflicts Tests (`ClassConflicts.test.tsx`)

```typescript
/**
 * File: frontend/src/features/ontology/components/ClassDetail/ClassConflicts.test.tsx
 *
 * Test: renders two columns (Base Definition, Extension Definition)
 *   - Pass conflict data with base and extension definitions
 *   - Expect column headers "Base Definition" and "Extension Definition" to be visible
 *
 * Test: shows resolution status label
 *   - Pass conflict data with a resolution status (e.g., "unresolved")
 *   - Expect the status label text to be visible
 *
 * Test: renders nothing when conflict data is null/undefined
 *   - Pass null or undefined as conflict data
 *   - Expect the component to return null (nothing rendered)
 */
```

---

## Implementation Details

### ClassDetail Container

**File:** `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx`

This is the container component for the entire right panel. It reads `selectedClassId` from `OntologyBrowserContext` and delegates rendering to sub-components.

Behavior:
- When `selectedClassId` is `null`, render a centered placeholder message: "Select a class to view details"
- When `selectedClassId` is set, call `useClassDetail(selectedClassId)` to fetch class data, properties, and current version
- While data is loading (`isLoading` is true or `isPlaceholderData` is true for the first load), render a loading skeleton. Use simple `div` elements with `animate-pulse` Tailwind classes (or a Skeleton component if one exists in the project). Do NOT use a spinner.
- Once data is loaded, render three sections vertically in a scrollable container:
  1. `ClassHeader` -- receives the class data object
  2. `ClassProperties` -- receives the properties array and current version
  3. `ClassConflicts` -- receives conflict data from the class; only rendered if conflict data is present

The container should use a `ScrollArea` (Shadcn) or simple `overflow-y-auto` div so that long property lists are scrollable.

### ClassHeader

**File:** `frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx`

Displays the class identity and metadata. Layout is a vertical stack with:

1. **Class name** -- rendered as a large heading (`text-2xl font-semibold`). This is always read-only because `UpdateClassInput` does not support name changes.

2. **Parent class** -- if `parent_class_id` is set, render a `ClassLink` component (from section-06 shared components) showing the parent class name. The parent class name needs to be resolved -- either passed as a prop from ClassDetail (which can look it up from the class list) or fetched separately. A simple approach: ClassDetail passes a `parentClassName` prop derived from the class list data available via `useClassTree` or a separate lookup.

3. **Source badge** -- render `SourceBadge` (from section-06) only when the class data has a `source_id` field. The `Class` interface currently does not include `source_id`, but the browser is designed for graceful degradation: if the field is not present on the API response, simply do not render the badge. Check for `(classData as any).source_id` or extend the type when the source feature is available.

4. **Description** -- render description text as a paragraph. The description supports click-to-edit (implemented fully in section-07). For this section, render the description as text. Optionally accept an `onDescriptionSave` callback prop that section-07 will wire up to the update mutation. For now, the click-to-edit behavior can be a simple text display that section-07 will enhance with the `EditableText` component.

### ClassProperties

**File:** `frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx`

Renders the list of properties for the selected class. Props include the `properties` array (`Property[]`), the current `version_id` (needed for creating new properties), and callback props for add/edit/delete operations.

Layout:
- A section heading ("Properties") with an "Add Property" button aligned to the right
- A list or table of properties, each row showing:
  - **Name** -- the property name
  - **Type** -- the `data_type` value (e.g., "string", "integer", "reference")
  - **Constraints** -- badges or text for `is_required` ("Required") and `is_unique` ("Unique")
  - **Actions** -- edit and delete icon buttons (Pencil and Trash2 from Lucide)
- If the properties array is empty, show a message: "No properties defined"
- The "Add Property" button toggles an inline form at the bottom of the list (form fields: name, data_type dropdown, is_required checkbox, is_unique checkbox, description)
- The inline add form has a Submit and Cancel button

The actual mutation calls (createProperty, updateProperty, deleteProperty) are wired in section-07. This section builds the UI structure and calls callback props. Delete confirmation uses Shadcn `AlertDialog`.

### ClassConflicts

**File:** `frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx`

This component implements graceful degradation for the conflict feature. It renders ONLY when conflict data exists on the class.

Props: `conflictData` which may be `null`, `undefined`, or an object containing conflict information.

When conflict data is present:
- Render a section heading ("Conflicts") with a warning icon
- Show a two-column layout:
  - Left column: "Base Definition" -- shows the class properties/description as defined by the base source
  - Right column: "Extension Definition" -- shows the properties/description as defined by the extending source
- Below the columns, show a resolution status label (e.g., "Unresolved", "Base wins", "Extension wins") styled as a Badge

When conflict data is `null` or `undefined`, the component returns `null` (renders nothing). This ensures the browser works regardless of whether the conflict/source feature (Split 01) is deployed.

The conflict data shape is not formally defined in the API types yet. Design the component to accept a flexible props interface:

```typescript
interface ConflictData {
  baseDefinition: Record<string, any>;
  extensionDefinition: Record<string, any>;
  resolutionStatus: 'unresolved' | 'base_wins' | 'extension_wins';
}

interface ClassConflictsProps {
  conflictData?: ConflictData | null;
}
```

---

## Component Dependency Summary

```
ClassDetail (container)
  ├── useClassDetail hook (section-02)
  ├── OntologyBrowserContext (section-03)
  ├── ClassHeader
  │     ├── ClassLink (section-06)
  │     └── SourceBadge (section-06)
  ├── ClassProperties
  │     └── AlertDialog (Shadcn, already available)
  └── ClassConflicts (graceful degradation, renders only with data)
```

Section-07 (inline editing) will later enhance ClassHeader with `EditableText` for description editing, and wire ClassProperties callbacks to actual TanStack Query mutations with optimistic updates.

---

## Implementation Notes (Post-Build)

### Deviations from plan
- **ClassHeader tests reduced from 7 to 5:** Click-to-edit and save description tests deferred to section-07 (inline editing), as noted in the spec. ClassHeader renders description as read-only text for now.
- **ClassLink stub updated** to accept `classId` and `children` props for parent class navigation.
- **No Skeleton component in Shadcn** — used `animate-pulse` div elements for loading skeleton.
- **ClassProperties uses native HTML form elements** (checkboxes, select) instead of Shadcn equivalents for simplicity.

### Actual files created/modified
- `ClassDetail.tsx` + `ClassDetail.test.tsx` — container with placeholder/skeleton/data states (5 tests)
- `ClassHeader.tsx` + `ClassHeader.test.tsx` — name, parent link, source badge, description (5 tests)
- `ClassProperties.tsx` + `ClassProperties.test.tsx` — property list with add/edit/delete (7 tests)
- `ClassConflicts.tsx` + `ClassConflicts.test.tsx` — conflict comparison with graceful degradation (3 tests)
- `shared/ClassLink.tsx` — updated stub with props

### Test count
20 tests (5 + 5 + 7 + 3), all passing