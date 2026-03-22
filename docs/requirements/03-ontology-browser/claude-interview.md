# Interview Transcript: 03 Ontology Browser

## Q1: Tree Data Source
**Q:** The spec mentions the tree should fetch from GET /api/ontology/classes?tree=true, but the existing API only has flat GET /api/ontology/classes. Should the browser build the hierarchy client-side from parent_class_id fields, or do you want a new backend endpoint that returns pre-built tree structure?

**A:** Client-side tree building — fetch flat class list, build hierarchy from parent references in the frontend.

## Q2: Source Data Availability
**Q:** The spec lists source badges and conflict indicators, but Split 01 (source-discovery-api) adds source_id to classes. Are the source-related API fields (source_id, conflict data) already implemented in the backend, or should the browser gracefully degrade when these fields are missing?

**A:** Not sure yet — need to check what's deployed. *Decision: browser should handle both cases gracefully.*

## Q3: Detail Panel Data Fetching
**Q:** For the class detail panel — should clicking a class fetch additional data beyond what's in the tree response, or should the tree response include everything needed?

**A:** Hybrid approach — tree includes summary data (id, name, parent, source_id), detail panel fetches properties and relationships separately on selection.

## Q4: Tree Library Choice
**Q:** Given the spec requires 500+ nodes, custom rendering (source badges, conflict icons), and full accessibility — which tree library?

**A:** @headless-tree/core — headless with @tanstack/react-virtual for virtualization, full control over rendering, best ARIA compliance, plugin-based architecture.

## Q5: Route Strategy
**Q:** Should /ontology/browser coexist alongside the existing /admin/ontology/Classes page or replace it?

**A:** Replace Classes page — the new browser becomes the primary class view, old page is deprecated.

## Q6: State Persistence
**Q:** Should browser panel sizes and tree expand/collapse state persist across sessions?

**A:** Persist in localStorage — remember panel sizes, expanded nodes, and last selected class.

## Q7: Search Scope
**Q:** Should search be a simple client-side text filter on class names, or support multi-criteria filtering?

**A:** Name search + source filter — text search for class names plus a separate source filter dropdown.

## Q8: Edit Support
**Q:** When the browser replaces the Classes page, should it be read-only or support editing?

**A:** Inline editing — click-to-edit on class name, description, properties in the detail panel.
