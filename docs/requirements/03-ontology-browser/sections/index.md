<!-- PROJECT_CONFIG
runtime: typescript-pnpm
test_command: cd frontend && pnpm vitest run
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-infrastructure
section-02-data-layer
section-03-layout-and-context
section-04-tree-component
section-05-detail-panel
section-06-shared-components
section-07-inline-editing
section-08-state-persistence
section-09-integration-testing
END_MANIFEST -->

# Implementation Sections Index

## Dependency Graph

| Section | Depends On | Blocks | Parallelizable |
|---------|------------|--------|----------------|
| section-01-infrastructure | - | all | Yes |
| section-02-data-layer | 01 | 03, 04, 05 | No |
| section-03-layout-and-context | 01, 02 | 04, 05, 07 | No |
| section-04-tree-component | 02, 03 | 07, 08 | Yes |
| section-05-detail-panel | 02, 03 | 07 | Yes |
| section-06-shared-components | 01 | 04, 05 | Yes |
| section-07-inline-editing | 03, 04, 05 | 09 | No |
| section-08-state-persistence | 03, 04 | 09 | No |
| section-09-integration-testing | all | - | No |

## Execution Order

1. section-01-infrastructure (no dependencies — deps, route, directory structure)
2. section-02-data-layer (after 01 — hooks, tree building algorithm)
3. section-03-layout-and-context, section-06-shared-components (parallel after 02 — layout is independent of shared components)
4. section-04-tree-component, section-05-detail-panel (parallel after 03 and 06 — tree and detail are independent)
5. section-07-inline-editing (after 04 and 05 — editing lives in detail panel)
6. section-08-state-persistence (after 04 — localStorage for expanded nodes, selected class)
7. section-09-integration-testing (final — E2E and integration tests)

## Section Summaries

### section-01-infrastructure
Install `@headless-tree/core`, `@headless-tree/react`, `@tanstack/react-virtual`. Create route at `src/routes/admin/ontology/browser.tsx`. Set up directory structure under `frontend/src/features/ontology/components/`.

### section-02-data-layer
Implement `useClassTree` hook (fetch classes, build tree hierarchy, search/filter), `useClassDetail` hook (fetch detail, properties, current version), and the pure `buildClassTree` algorithm. Query key strategy. Reuses existing API functions from `@/features/ontology/lib/api`.

### section-03-layout-and-context
Implement `OntologyBrowser` layout with `react-resizable-panels` (PanelGroup, two Panels, PanelResizeHandle with collapse toggle). `OntologyBrowserContext` with selectedClassId, labelMode, stale selection recovery. Error boundaries wrapping each panel.

### section-04-tree-component
Implement `ClassTree` (headless tree + virtualization), `ClassTreeNode` (indentation, chevron, badges), `ClassTreeSearch` (search input + source filter dropdown). ARIA compliance, keyboard navigation.

### section-05-detail-panel
Implement `ClassDetail` container, `ClassHeader` (read-only name, editable description, parent link, source badge), `ClassProperties` (property list with add/edit/delete), `ClassConflicts` (graceful degradation).

### section-06-shared-components
Implement `SourceBadge` (hash-based color, abbreviated name), `ConflictBadge` (AlertTriangle + tooltip), `ClassLink` (clickable navigation).

### section-07-inline-editing
Implement click-to-edit pattern (`EditableText` component), description editing mutation, property CRUD mutations with optimistic updates, class creation dialog, validation.

### section-08-state-persistence
localStorage persistence for expanded nodes (debounced), selected class, source filter, label mode. Corrupt data fallback. Panel sizes handled by `autoSaveId` (built-in).

### section-09-integration-testing
Component integration tests (tree ↔ detail panel interaction, navigation flow). E2E Playwright tests for full browser workflow.
