# Opus Review

**Model:** claude-opus-4
**Generated:** 2026-03-22T21:10:00+01:00

---

## Key Findings

1. **Factual error**: Tabs component IS Radix-based (standard shadcn), not custom. Fix the claim.
2. **Missing redirect**: Old URL `/admin/ontology/browser` will 404 with no redirect to `/ontology`.
3. **Auth pattern unclear**: Referenced `/projects` route has no auth guard. Clarify actual pattern.
4. **File path prefix**: Plan uses `src/routes/` but project structure is `frontend/src/routes/`.
5. **Tab state reset**: Uncontrolled tabs won't reset to "Detail" when class changes. Use `key={selectedClassId}` or controlled state.
6. **Scroll behavior**: Tab bar should stay pinned while content scrolls. Plan doesn't address.
7. **Layout vs leaf route**: `ontology.tsx` creates a layout route expecting children. Use `ontology.index.tsx` if standalone.
8. **Breadcrumb impact**: Moving from nested admin route changes breadcrumb trail.
9. **Risk understated**: Breaking URL change with no migration path — moderate, not low.
