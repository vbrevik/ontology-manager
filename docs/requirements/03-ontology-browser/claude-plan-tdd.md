# TDD Plan: Ontology Browser

Companion to `claude-plan.md`. Defines tests to write BEFORE implementing each section.

**Testing stack:** Vitest 3.0.5 + jsdom + @testing-library/react + @testing-library/jest-dom
**Setup file:** `src/test/setup.ts`
**Convention:** Test files live alongside source files as `*.test.ts` or `*.test.tsx`

---

## 2. Infrastructure

No tests needed for dependency installation or route registration. Verify route renders after Section 4.

---

## 3. Data Layer

### useClassTree Hook (`useClassTree.test.ts`)

- Test: returns empty tree structure when class list is empty
- Test: builds correct parent-child hierarchy from flat class list
- Test: root nodes are those with `parent_class_id === null`
- Test: orphaned nodes (parent_class_id references non-existent parent) become root nodes
- Test: children are sorted alphabetically by name at each level
- Test: converts to headless-tree format with `rootItem`, `items` record, and `children` arrays
- Test: text filter returns only nodes matching case-insensitive substring on class name
- Test: text filter includes ancestor path of matching nodes (preserves tree navigability)
- Test: source filter returns only classes with matching source_id plus ancestors
- Test: source filter is no-op when no classes have source_id
- Test: combined text + source filter applies both conditions

### useClassDetail Hook (`useClassDetail.test.ts`)

- Test: fetches class detail, properties, and current version when classId provided
- Test: does not fetch when classId is null (queries disabled)
- Test: provides mutation function for description update
- Test: provides mutation function for property CRUD with version_id
- Test: handles API errors gracefully (returns error state, does not throw)

### Tree Building Algorithm (pure function, `buildClassTree.test.ts`)

- Test: builds correct Map from flat array
- Test: groups children by parent_class_id
- Test: handles single root node
- Test: handles multiple root nodes
- Test: handles deeply nested hierarchy (3+ levels)
- Test: handles class with no children (leaf node)

---

## 4. Layout and Panels

### OntologyBrowser (`OntologyBrowser.test.tsx`)

- Test: renders PanelGroup with two panels
- Test: left panel contains ClassTree
- Test: right panel contains ClassDetail
- Test: wraps children in OntologyBrowserContext provider
- Test: error boundary in tree panel catches errors without crashing detail panel
- Test: error boundary in detail panel catches errors without crashing tree panel

### OntologyBrowserContext (`OntologyBrowserContext.test.tsx`)

- Test: initializes selectedClassId from localStorage if present
- Test: defaults selectedClassId to null if localStorage empty
- Test: persists selectedClassId to localStorage on change
- Test: clears selectedClassId to null when class not found in class list (stale recovery)
- Test: provides labelMode and toggleLabelMode

---

## 5. Tree Component

### ClassTree (`ClassTree.test.tsx`)

- Test: renders search bar and tree container
- Test: renders tree nodes from provided class data
- Test: clicking a node calls setSelectedClassId
- Test: selected node has bg-accent class
- Test: expand/collapse works on chevron click
- Test: keyboard Up/Down arrows navigate between nodes
- Test: keyboard Left/Right collapse/expand nodes
- Test: keyboard Enter selects focused node
- Test: Home/End keys jump to first/last node

### ClassTreeNode (`ClassTreeNode.test.tsx`)

- Test: renders class name
- Test: renders description when labelMode is 'description'
- Test: indentation increases with tree depth level
- Test: shows chevron only when node has children
- Test: rotates chevron when node is expanded
- Test: renders SourceBadge when source_id present
- Test: does not render SourceBadge when source_id absent
- Test: renders conflict icon when conflict data present
- Test: does not render conflict icon when conflict data absent

### ClassTreeSearch (`ClassTreeSearch.test.tsx`)

- Test: renders search input
- Test: typing in search input triggers onSearchChange (debounced 300ms)
- Test: renders source filter dropdown when classes have source_id
- Test: hides source filter dropdown when no classes have source_id
- Test: selecting a source filter triggers onSourceFilterChange

---

## 6. Detail Panel

### ClassDetail (`ClassDetail.test.tsx`)

- Test: shows "Select a class" placeholder when no class selected
- Test: renders ClassHeader, ClassProperties when class selected
- Test: renders ClassConflicts only when conflict data present
- Test: does not render ClassConflicts when no conflict data
- Test: shows loading skeleton while data is loading

### ClassHeader (`ClassHeader.test.tsx`)

- Test: renders class name as read-only text (not editable)
- Test: renders parent class as clickable ClassLink
- Test: renders SourceBadge when source_id present
- Test: hides SourceBadge when source_id absent
- Test: renders description text
- Test: clicking description enters edit mode
- Test: saving description calls updateClass mutation

### ClassProperties (`ClassProperties.test.tsx`)

- Test: renders property list with name, type, constraints
- Test: renders "Add Property" button
- Test: clicking Add opens inline form
- Test: submitting add form calls createProperty with version_id
- Test: clicking edit on property enters edit mode
- Test: clicking delete shows confirmation dialog
- Test: confirming delete calls deleteProperty

### ClassConflicts (`ClassConflicts.test.tsx`)

- Test: renders two columns (Base Definition, Extension Definition)
- Test: shows resolution status label
- Test: renders nothing when conflict data is null/undefined

---

## 7. Shared Components

### SourceBadge (`SourceBadge.test.tsx`)

- Test: renders badge with abbreviated source name
- Test: generates consistent color from sourceId hash
- Test: same sourceId always produces same color
- Test: renders nothing when sourceId is null/undefined
- Test: clicking badge triggers source filter callback

### ConflictBadge (`ConflictBadge.test.tsx`)

- Test: renders AlertTriangle icon
- Test: shows tooltip on hover

### ClassLink (`ClassLink.test.tsx`)

- Test: renders class name as link text
- Test: clicking calls setSelectedClassId with correct classId
- Test: has correct styling classes

---

## 8. Inline Editing

### EditableText (shared editing component, `EditableText.test.tsx`)

- Test: displays text in view mode
- Test: shows edit icon on hover
- Test: clicking switches to edit mode with input/textarea
- Test: input is auto-focused in edit mode
- Test: pressing Enter saves (calls onSave callback)
- Test: blur saves (calls onSave callback)
- Test: pressing Escape cancels (reverts to original value)
- Test: shows spinner during save (when loading prop is true)
- Test: input is disabled during save

### Class Creation Dialog (`CreateClassDialog.test.tsx`)

- Test: opens dialog on button click
- Test: requires class name (shows validation error if empty)
- Test: submits with name, description, parent_class_id, is_abstract
- Test: calls createClass on submit
- Test: closes dialog on success
- Test: shows error toast on failure

---

## 9. State Persistence

Covered by OntologyBrowserContext and useClassTree tests above. Additional:

- Test: expanded node state is persisted to localStorage
- Test: expanded node state is restored from localStorage on mount
- Test: corrupt localStorage data falls back to defaults
- Test: source filter state persists to localStorage

---

## 10. Testing Strategy (E2E)

E2E tests use Playwright and hit the running dev server. These are written after all component tests pass:

- Test: navigate to `/admin/ontology/browser`, page loads with tree and detail panels
- Test: click a class in tree, detail panel shows class info
- Test: expand/collapse tree nodes via click
- Test: search filters tree nodes
- Test: click ClassLink in detail panel, tree navigates to that class
- Test: inline edit description, verify persistence after reload
- Test: create new class via dialog
- Test: resize panels, reload, verify sizes persist
- Test: keyboard navigation through tree
