# Section 05 Code Review Interview

## Triage — All items auto-resolved

### module: "node16" vs "ES2020" (MEDIUM)
**Decision:** Keep node16. tsc 5.9 requires module=node16 when moduleResolution=node16 (TS5110 error). Source files already use .js extensions on all imports. Documented deviation.

### skipLibCheck: true (LOW)
**Decision:** Keep. Required for ajv/ajv-formats CJS type export issues. Same approach used in tsconfig.jsdoc-check.json from section-04.

### MPCGNode/MPCGEdge test location (LOW)
**Decision:** Let go. MPCGNode/MPCGEdge are defined in validate.js via @typedef, so they correctly appear in validate.d.ts. The test is accurate.
