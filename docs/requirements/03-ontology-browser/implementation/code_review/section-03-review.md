# Code Review: Section 03 — Layout and Context

## Failure Condition Checklist

| Condition | Status |
|---|---|
| All 11 specified test cases present | PASS |
| No raw HTML rendering (V-222602) | PASS |
| No crash on malformed localStorage (V-222609) | PASS |
| Tree panel error cannot crash detail panel | PASS |
| Detail panel error cannot crash tree panel | PASS |

## Critical

### 1. Toast exit animation bypassed by double-dismiss timer
**Confidence: 95** — Not in section-03 scope (toast.tsx changes are from prior work). Defer.

## Important

### 2. Interactive button nested inside ARIA role="separator"
**Confidence: 88** — The collapse toggle Button is inside ResizableHandle which renders as role="separator". This violates ARIA spec (no interactive descendants in separator). The button may also have pointer event issues.

**Suggested fix:** Move collapse button outside ResizableHandle, overlay it on the panel edge instead.

### 3. Stale recovery effect re-runs O(n) scan on every selection change
**Confidence: 80** — The useEffect has `selectedClassId` in deps, causing the classList.some() scan on every selection change. Should only run when classList changes.

**Suggested fix:** Use a ref for selectedClassId to remove it from effect deps.

## Observations (no action required)
- useRef vs usePanelRef — useRef works but usePanelRef() is idiomatic for v4
- resizable.tsx v4 migration is correct
- Error boundary reset logic is sound
- Context encapsulation improved (context no longer re-exported)
