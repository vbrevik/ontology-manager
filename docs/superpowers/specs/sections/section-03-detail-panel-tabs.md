Now I have all the context needed. Let me generate the section content.

# Section 03: Detail Panel Tabs

## Overview

This section adds a tabbed interface to the `ClassDetail` component in the ontology browser. When a class is selected, the detail panel shows three tabs: **Detail** (existing content), **Graph** (stub), and **Relationships** (stub). The tab bar is pinned at the top while tab content scrolls. Tabs reset to "Detail" when the selected class changes.

This section has **no dependencies** on other sections and can be implemented in parallel with section-01.

## Background

The ontology browser has a split-pane layout: a class tree on the left and a detail panel on the right. The detail panel is rendered by `ClassDetail` at:

```
frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
```

Currently, `ClassDetail` renders `ClassHeader`, `ClassProperties`, and `ClassConflicts` directly. After this change, that content moves into a "Detail" tab, and two placeholder tabs ("Graph", "Relationships") are added alongside it.

The project already has the shadcn `Tabs` component installed at `frontend/src/components/ui/tabs.tsx`, which exports `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` (Radix-based). No new UI dependencies are needed.

## Tests (Write First)

**File:** `frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx`

Add the following tests to the existing `describe('ClassDetail', ...)` block. The existing mocks (`mockSelectedClassId`, `mockClassData`, `mockProperties`, etc.) and `renderWithProviders` helper are already in place and sufficient.

### Test: renders three tabs when a class is selected

Set `mockSelectedClassId` and `mockClassData` to valid values. After render, query for all elements with `role="tab"`. Assert that exactly three tabs exist and their accessible names are "Detail", "Graph", and "Relationships".

```
screen.getAllByRole('tab') → expect length 3
expect names to include 'Detail', 'Graph', 'Relationships'
```

### Test: Detail tab is active by default and shows class content

With a class selected and `mockClassData`/`mockProperties` populated, verify that the Detail tab has `aria-selected="true"` (or use `data-state="active"` from Radix). Verify that class content (e.g., the class name heading, a property name) is visible in the document.

### Test: Graph tab renders placeholder with icon and description text

With a class selected, click the "Graph" tab trigger. Assert that text matching "Graph visualization" (or a suitable substring) appears in the document.

### Test: Relationships tab renders placeholder with icon and description text

With a class selected, click the "Relationships" tab trigger. Assert that text matching "Relationship explorer" (or a suitable substring) appears in the document.

### Test: no tabs render when no class is selected

Leave `mockSelectedClassId` as `null`. After render, assert `screen.queryAllByRole('tab')` has length 0. Assert the "Select a class" placeholder text is present.

### Test: switching classes resets to Detail tab (key-based remount)

This test verifies the `key={selectedClassId}` pattern. Render with class A selected, click the "Graph" tab (to move away from Detail), then re-render with class B selected (by changing `mockSelectedClassId` and `mockClassData`, then calling `rerender`). After re-render, the Detail tab should be active again, not Graph.

Note: Since the mocks are module-level variables, you can change them and call `rerender(<QueryClientProvider ...><ClassDetail /></QueryClientProvider>)` to trigger a re-render with new mock values.

## Implementation

**File to modify:** `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx`

### Imports to Add

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Network, GitFork } from 'lucide-react'
```

`Network` is used for the Graph tab placeholder icon. `GitFork` is used for the Relationships tab placeholder icon. Choose icons that convey the concept; these are recommendations.

### Structural Changes

The `ClassDetail` component's return value when a class IS selected changes from a single scrollable div to a `Tabs` wrapper. The key changes:

1. The outer `<div className="h-full overflow-y-auto p-4">` is replaced by a `<Tabs>` component with `defaultValue="detail"` and `key={selectedClassId}`.

2. The `key={selectedClassId}` on `Tabs` forces React to unmount and remount the entire `Tabs` tree when the selected class changes, which resets tab state to the `defaultValue` ("detail").

3. The outer container uses `flex flex-col h-full` so the tab bar pins at the top.

4. `TabsList` renders three `TabsTrigger` elements.

5. Three `TabsContent` blocks follow, with the "detail" content containing the existing `ClassHeader`, `ClassProperties`, `ClassConflicts` markup.

### Layout Pattern

The component structure when a class is selected should follow this pattern:

```
<div className="flex h-full flex-col" data-testid="class-detail">
  <Tabs defaultValue="detail" key={selectedClassId} className="flex h-full flex-col">
    <TabsList className="...shrink-0 styling...">
      <TabsTrigger value="detail">Detail</TabsTrigger>
      <TabsTrigger value="graph">Graph</TabsTrigger>
      <TabsTrigger value="relationships">Relationships</TabsTrigger>
    </TabsList>

    <TabsContent value="detail" className="flex-1 overflow-y-auto p-4">
      <!-- existing ClassHeader, ClassProperties, ClassConflicts content -->
    </TabsContent>

    <TabsContent value="graph" className="flex-1 overflow-y-auto p-4">
      <!-- placeholder stub -->
    </TabsContent>

    <TabsContent value="relationships" className="flex-1 overflow-y-auto p-4">
      <!-- placeholder stub -->
    </TabsContent>
  </Tabs>
</div>
```

### Placeholder Tab Content

Each stub tab renders a centered layout with muted styling:

- A lucide icon (e.g., `Network` for Graph, `GitFork` for Relationships) rendered at a moderate size with `text-muted-foreground`
- A heading (e.g., "Graph visualization" or "Relationship explorer")
- A brief description line (e.g., "Visual graph view coming soon" or "Explore class relationships coming soon")

Use `flex items-center justify-center h-full` centering with `text-muted-foreground` for the muted look.

### No-Selection State

When `!selectedClassId`, the component returns the existing placeholder div (no tabs, no changes). This is already handled by the early return.

### Loading State

When `isLoading || isPlaceholderData || !classData`, the component returns the existing `DetailSkeleton` (no tabs shown during loading). This is already handled by the early return before the tabs markup.

### Preserving data-testid

Keep `data-testid="class-detail"` on the outer container in all states (no-selection, loading, and with-tabs) to avoid breaking existing tests.

## Files Summary

| File | Action |
|------|--------|
| `frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx` | Modify -- add 6 new tab-related tests |
| `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx` | Modify -- wrap selected-class content in Tabs |

No new files are created. The shadcn Tabs component (`frontend/src/components/ui/tabs.tsx`) already exists and requires no changes.