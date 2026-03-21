# Spec Contract

## GOAL
`claude-spec.md` must capture the complete, synthesized requirements for the MPCG REST API server — combining the original spec, codebase research, web research, and interview answers into a single authoritative requirements document.

## CONSTRAINTS
- Must incorporate all requirements from spec.md, claude-research.md, and claude-interview.md
- Must not add implementation decisions beyond what was explicitly decided in the interview
- Must not include architecture or code-level implementation choices

## FAILURE CONDITIONS
- SHALL NOT omit requirements from any input source
- SHALL NOT include architecture or implementation choices (e.g., specific middleware ordering, file structure decisions)
- SHALL NOT contradict interview decisions
