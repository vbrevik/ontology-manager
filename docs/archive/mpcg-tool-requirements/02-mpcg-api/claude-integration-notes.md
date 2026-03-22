# Integration Notes — Opus Review

## Integrating

1. **#1 Double validation** — Integrate. Change to catch MPCGGraph constructor error instead of pre-validating. Simpler, no double work.

2. **#3 Route ordering** — Integrate. Must register `/groups` before `/:id`. Real bug if not addressed.

3. **#4 maxDepth parameter** — Integrate. Add `?maxDepth=N` optional query param to causal-chain endpoint. Low cost, useful.

4. **#5 releasableTo parameter** — Integrate. Add `?releasableTo=X` optional query param to visible endpoint. Forward-compatible.

5. **#6 Classification validation** — Integrate. Validate classification against known STANAG 4774 levels, return 400 for unknown values.

6. **#7 Drop uuid dependency** — Integrate. Use `crypto.randomUUID()` instead. Already used in test fixtures.

7. **#10 Content-Type for errors** — Integrate. Set `Content-Type: application/problem+json` on RFC 7807 responses.

8. **#11 Duplicate labels** — Integrate. Use first-match behavior, log warning. Scenarios are expected to have unique labels.

9. **#12 DELETE endpoint** — Integrate. Add `DELETE /api/graph/:id` for quality of life. Trivial to implement.

10. **#14 Scenario caching** — Integrate. Clarify: load scenario metadata at startup, construct graphs lazily on first request and cache.

11. **#15 Missing overwrite test** — Integrate. Add test for graph overwrite behavior.

12. **#16 provenance undefined filtering** — Integrate. Add `.filter(Boolean)` to provenance results in the API layer as defensive measure.

## NOT Integrating

1. **#2 Scenario ID collision** — Not integrating as a code change. Scenario IDs are unique by convention in the existing dataset. If collision occurs, last-write-wins is acceptable. Not worth the complexity.

2. **#8 Configurable CORS** — Not integrating. This is a local dev tool with a known frontend port. Adding env var configurability is scope creep for the current iteration.

3. **#9 Memory bounds** — Not integrating. User explicitly chose "Simple Map, no limits" during interview. This is a dev tool.

4. **#13 Constraint drift** — Not integrating as core package change (out of scope for this plan). Will add a comment noting the static data source. A future PR can export rules from @mpcg/core.

5. **#17 Section mapping** — Not applicable here. The deep-plan workflow handles section splitting in later steps.
