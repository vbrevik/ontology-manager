# Prompt Contract: Section 01 - Infrastructure

## GOAL
Set up the Ontology Browser foundation: install 3 npm packages, create route file, scaffold 16 placeholder component/hook files.

## CONSTRAINTS
- Use pnpm (project package manager)
- Route at `/admin/ontology/browser` under existing admin/ontology layout
- All placeholder files must export named components/hooks so imports resolve
- Do not modify existing Classes route

## FORMAT
- Modified: `frontend/package.json`, `frontend/pnpm-lock.yaml`
- Created: `frontend/src/routes/admin/ontology/browser.tsx`
- Created: 14 placeholder files under `frontend/src/features/ontology/components/`

## FAILURE CONDITIONS
- SHALL NOT modify existing routes or components
- SHALL NOT skip any placeholder file from the spec
