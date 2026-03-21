# Section 04 Code Review Interview

## Decisions

### Finding #1: ValidationResult.stats optional (HIGH)
**Decision:** Make stats required, add zeroed stats to early return
**Action:** Fixed — early return now includes `stats: { nodes: 0, edges: 0, nodeTypes: 0, edgeTypes: 0, errors: errors.length, warnings: 0 }`. Typedef changed back to required `stats: ValidationStats`.

### Finding #2: graph-engine.js scope (HIGH)
**Decision:** Let go — graph-engine.js was copied from src/ during section-02 package structure. Annotations are in-scope for this section.

### Finding #3: @ts-ignore → @ts-expect-error (MEDIUM)
**Decision:** Auto-fixed — replaced both `@ts-ignore` with `@ts-expect-error` for better maintenance signals.

### Findings #4-7: Let go
- Combined tsc test is cleaner; error output still shows filenames
- Negative tests, releasableTo param, regex fragility are nitpicks
