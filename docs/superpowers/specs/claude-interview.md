# Interview Transcript

## Brainstorming Phase (pre-research)

### Q1: What should the primary experience be when a logged-in user opens the app?
**Answer:** Ontology as a top-level section (Option 2). User lands on current dashboard, but "Ontology" is a primary nav item alongside Projects/Targeting at `/ontology`, not buried under Admin.

### Q2: What should happen to existing /admin/ontology/* routes?
**Answer:** Split by purpose (Option 2). Browsing/exploration moves to `/ontology` (core). Schema governance (versions, approvals, designer) stays under `/admin`. Two entry points, separated by intent.

### Q3: What should the /ontology route structure look like?
**Answer:** Browser with integrated panels (Option 3). `/ontology` is the browser, but the detail panel on the right can switch modes (class detail, graph view, relationships) via tabs within the panel. The tree stays constant.

### Q4: Implementation approach?
**Answer:** Approach A — Route move + MainSidebar update. Minimal code change, reuses everything from sections 01-09. Detail panel gets tab bar for future graph/relationships views (stubs initially).

## Post-Research Questions

### Q5: Tab implementation — use existing shadcn Tabs or inline?
**Answer:** Use existing shadcn Tabs component for consistency with the rest of the project.

### Q6: Auth behavior at /ontology for unauthenticated users?
**Answer:** Redirect to /login.

### Q7: Stub style for Graph and Relationships tabs?
**Answer:** Visual hint with icon — icon + description of upcoming feature, styled but non-functional.

## Summary of Key Decisions

- Route: `/admin/ontology/browser` → `/ontology`
- Nav: Second item in MainSidebar after Dashboard
- Admin governance routes stay under `/admin/ontology/*`
- Detail panel: shadcn Tabs with Detail (working) + Graph/Relationships (visual stubs)
- Auth: redirect to /login when unauthenticated
- Graph and Relationships are future work (separate planning cycle)
