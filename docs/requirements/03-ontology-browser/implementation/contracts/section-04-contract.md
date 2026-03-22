# Section 04: Tree Component — Prompt Contract

## GOAL
Implement ClassTree, ClassTreeNode, and ClassTreeSearch components that provide a virtualized, keyboard-navigable, ARIA-compliant class hierarchy tree with search and source filtering.

## CONTEXT
Section 04 builds the left panel content for the ontology browser. It depends on section 02 (useClassTree data layer) and section 03 (OntologyBrowserContext for selected state). The shared components (SourceBadge, ConflictBadge) from section 06 are stubbed.

## CONSTRAINTS
- Use @headless-tree/core with buildProxiedInstance, syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature
- Use @tanstack/react-virtual for virtualization
- ARIA: role="tree", role="treeitem", aria-expanded, aria-selected, roving tabindex
- React default JSX escaping only (V-222602)
- Handle empty/loading states gracefully (V-222609)
- Mock headless-tree and virtualizer in unit tests (jsdom limitations)

## FORMAT — Files to create/modify
- `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` (replace stub)
- `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx` (replace stub)
- `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx` (replace stub)
- `frontend/src/features/ontology/components/ClassTree/ClassTree.test.tsx` (new)
- `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.test.tsx` (new)
- `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.test.tsx` (new)

## FAILURE CONDITIONS
- SHALL NOT skip specified test cases
- SHALL NOT use raw HTML rendering (V-222602)
- SHALL NOT crash on empty tree data or loading states
- SHALL NOT break ARIA tree pattern (role, aria-expanded, aria-selected)
