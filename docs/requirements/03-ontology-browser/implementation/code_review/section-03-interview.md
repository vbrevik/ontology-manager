# Section 03 Code Review Interview

## Triage

| # | Finding | Disposition | Reason |
|---|---------|-------------|--------|
| 1 | Toast double-dismiss timer | **Auto-fix** (per user request) | User requested fix; clear bug |
| 2 | Button inside ARIA separator | **Auto-fix** (per user request) | ARIA violation; moved button outside handle |
| 3 | Stale recovery effect deps | **User: optimize** | User chose ref optimization |

## Fixes Applied

### Fix 1: Toast double-dismiss timer (toast.tsx)
Removed the redundant `setTimeout` in `ToastProvider.toast()` that raced with `ToastItem`'s own dismiss lifecycle. The `ToastItem` useEffect already handles: wait duration → set isExiting → wait 300ms animation → call onDismiss. The provider-level timer was removing the toast from state before the exit animation could play.

### Fix 2: Button outside ARIA separator (OntologyBrowser.tsx)
Moved the collapse toggle `Button` from inside `ResizableHandle` (which renders `role="separator"`) to inside the tree `ResizablePanel` with absolute positioning. This ensures the button is keyboard-accessible and not trapped inside a non-interactive landmark element.

### Fix 3: Stale recovery ref optimization (OntologyBrowserContext.tsx)
Changed the stale recovery `useEffect` to read `selectedClassId` from a ref instead of having it in the dependency array. The effect now only re-runs when `classList` changes (data loads/reloads), not on every selection change. This avoids an O(n) `classList.some()` scan on every click.
