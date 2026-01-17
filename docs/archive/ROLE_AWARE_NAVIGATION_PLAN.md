## Role-Aware Navigation Plan

### Goal
Deliver a role-aware navigation system that:
- Shows only relevant items to each user.
- Lets admins preview the effect of role/permission changes before they apply them.
- Makes the consequence of a change visible (what appears/disappears, what flows break).

### Move Onboarding for Later
Onboarding work is explicitly deferred. Do not change `OnboardingGuide` placement or behavior in this iteration.

### Scope
- Admin + main navigation gating based on ABAC/ReBAC permissions.
- A "Navigation Impact Simulator" in Admin for previewing changes.
- Consistent, explainable "why visible/hidden" reasons per nav item.

### Non-Goals (Do NOT Do)
- Do not redesign the global information architecture in this iteration.
- Do not replace the ABAC/ReBAC system or rename existing permissions.
- Do not add or change onboarding flows right now (deferred).
- Do not create a separate navigation system per tenant before the simulator exists.
- Do not add new nav items unless tied to a permission rule.

---

## Current State (Short Summary)
- Admin sidebar has hardcoded `requiredPermission` values.
- Navbar always shows "Administration" for authenticated users, even if access is denied.
- There is no preview/simulation of nav visibility or impact.

---

## Design Principles
- **Backend-first**: server should compute visibility to guarantee parity.
- **Explainability**: each item includes `visible: true/false` and `reason`.
- **Diff-based impact**: show before/after lists and counts.
- **Safe by default**: if no permission is known, hide the item.

---

## Backend Plan (Phase 1)

### 1) Canonical Navigation Model
Create a single source of truth on the backend:
- Define nav items + sections + required permissions.
- Include stable IDs to support diffing.

**Proposed shape**
```
NavSection {
  id, label, items: NavItem[]
}
NavItem {
  id, label, href, icon, required_permissions[], children[]
}
```

### 2) Visibility Evaluation Endpoint
Add an endpoint that returns the nav tree with visibility and reasons:
- `POST /api/navigation/evaluate`
- Input: `user_id` or `roles`/`permissions` override for simulation.
- Output: `visible`, `reasons[]`, `missing_permissions[]`.

### 3) Impact Simulation Endpoint
Add an endpoint to compute a diff:
- `POST /api/navigation/simulate`
- Input: `baseline` (user or permission set), `proposed` (role/permission change).
- Output:
  - `added_items[]`
  - `removed_items[]`
  - `unchanged_items[]`
  - `summary` (counts + "top 3 changes")

### 4) Audit & Logging
Log simulation requests and applied changes:
- Who ran the sim, when, and what changed.
- This makes policy changes explainable later.

---

## Frontend Plan (Phase 2)

### 1) Role-Aware Navigation Rendering
Use backend-evaluated nav tree:
- Replace local permission checks with server response.
- Still allow local fallback (cached response) for offline nav.

### 2) "Navigation Impact Simulator" UI
Add to `/admin/roles` or a new `/admin/navigation` page:
- Inputs: user or role set.
- "Proposed change" form: add/remove role/permission.
- Visual diff: Before/After columns with icons and counts.
- Explainability: show "hidden because missing: `ui.view.*`".

### 3) Safe UX Changes
- Hide "Administration" menu for non-admin users.
- Show a short tooltip or `Request access` callout when hidden items are relevant.

---

## Visualization / Simulation UX
- **Before/After** nav tree with diff badges.
- **Counts**: "4 items added, 2 removed".
- **Reason lines** below each hidden item (missing permissions).
- **Impact summary** block: highlights high-risk changes.

---

## Acceptance Criteria
- Admin can select a user or role set and preview nav visibility.
- Admin sees which nav items will appear/disappear and why.
- Non-admin users never see admin entry points.
- All nav visibility logic matches server evaluation.

---

## Risks / Mitigations
- **Mismatch between frontend and backend nav definitions**  
  Mitigation: keep nav source of truth in backend and drive UI from it.
- **Slow simulation**  
  Mitigation: cache common simulations and debounce inputs.
- **Permission drift**  
  Mitigation: map nav item IDs to permission schema; validate on server.

---

## Suggested Implementation Order
1. Backend nav model and evaluation endpoint.
2. Simulation endpoint + diff output.
3. Frontend integration + simulator UI.
4. Hide admin entry points for non-admins.
5. Add tests for visibility and simulator diffs.

---

## Test Plan

### Unit Tests (Backend)
- **Nav model validation**: required permissions, stable IDs, child structure.
- **Visibility evaluation**: user permission set → visible items + reasons.
- **Diff logic**: baseline vs proposed produces correct added/removed/unchanged lists.
- **Reason strings**: missing permissions are listed and consistent.

### Integration Tests (Backend)
- **Evaluate endpoint**: `POST /api/navigation/evaluate` with user context returns expected tree.
- **Simulate endpoint**: `POST /api/navigation/simulate` returns accurate diff for a known role change.
- **Auth gating**: non-admin cannot call simulator; admin can.
- **Audit log**: simulator calls produce audit entries.

### E2E Tests (Playwright)
- **Admin nav visibility**: non-admin does not see "Administration" entry.
- **Admin simulator**: admin selects user/roles and sees before/after diff.
- **Role change impact**: apply role change → nav updates on next load.

### GUI/UX Tests (Manual or Scripted)
- **Visual diff clarity**: added/removed items are obvious and labeled.
- **Explainability**: user can see why an item is hidden (missing permissions).
- **Empty states**: no changes, no items, missing permissions.
- **Performance**: simulator responds within acceptable latency (< 500ms for typical users).

#### Playwright GUI/UX Requirements (Add Now)
- **Stable selectors**: add `data-testid` to key UI elements (nav items, diff panels, reason text).
- **Snapshot coverage**: use `toHaveScreenshot` for:
  - Admin nav (collapsed/expanded).
  - Simulator before/after panel.
  - Empty/zero-diff state.
- **Responsive checks**: run at desktop + tablet breakpoints.
- **A11y smoke checks**: ensure buttons/inputs are keyboard reachable and have labels.
- **Animation tolerance**: disable or freeze animations in tests where possible.
