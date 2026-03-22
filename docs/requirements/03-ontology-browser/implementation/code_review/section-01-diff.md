diff --git a/frontend/package.json b/frontend/package.json
index e65441a..748f124 100644
--- a/frontend/package.json
+++ b/frontend/package.json
@@ -13,6 +13,8 @@
     "test": "vitest run"
   },
   "dependencies": {
+    "@headless-tree/core": "^1.6.3",
+    "@headless-tree/react": "^1.6.3",
     "@hookform/resolvers": "^3.10.0",
     "@radix-ui/react-alert-dialog": "^1.1.15",
     "@radix-ui/react-collapsible": "^1.1.12",
@@ -32,6 +34,7 @@
     "@tanstack/react-query": "^5.90.18",
     "@tanstack/react-router": "^1.132.0",
     "@tanstack/react-router-devtools": "^1.132.0",
+    "@tanstack/react-virtual": "^3.13.23",
     "@tanstack/router-plugin": "^1.132.0",
     "@types/dagre": "^0.7.53",
     "class-variance-authority": "^0.7.1",
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx
new file mode 100644
index 0000000..664cd68
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx
@@ -0,0 +1,3 @@
+export function ClassConflicts() {
+  return <div>ClassConflicts placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
new file mode 100644
index 0000000..2c5cf4d
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
@@ -0,0 +1,3 @@
+export function ClassDetail() {
+  return <div>ClassDetail placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
new file mode 100644
index 0000000..c97093d
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
@@ -0,0 +1,3 @@
+export function ClassHeader() {
+  return <div>ClassHeader placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx
new file mode 100644
index 0000000..46c9ea5
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx
@@ -0,0 +1,3 @@
+export function ClassProperties() {
+  return <div>ClassProperties placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts b/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
new file mode 100644
index 0000000..04e04c3
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
@@ -0,0 +1,5 @@
+/** Hook: fetch class detail, properties, current version for selected class */
+export function useClassDetail(_classId: string | null) {
+  // Implemented in Section 02
+  return { classData: null, properties: [], isLoading: true }
+}
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
new file mode 100644
index 0000000..0385934
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
@@ -0,0 +1,3 @@
+export function ClassTree() {
+  return <div>ClassTree placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx
new file mode 100644
index 0000000..efbfab7
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx
@@ -0,0 +1,3 @@
+export function ClassTreeNode() {
+  return <div>ClassTreeNode placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx
new file mode 100644
index 0000000..0c70046
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx
@@ -0,0 +1,3 @@
+export function ClassTreeSearch() {
+  return <div>ClassTreeSearch placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/ClassTree/useClassTree.ts b/frontend/src/features/ontology/components/ClassTree/useClassTree.ts
new file mode 100644
index 0000000..7a54ff6
--- /dev/null
+++ b/frontend/src/features/ontology/components/ClassTree/useClassTree.ts
@@ -0,0 +1,5 @@
+/** Hook: fetch classes, build tree hierarchy, manage search/filter state */
+export function useClassTree() {
+  // Implemented in Section 02
+  return { treeItems: {}, rootIds: [] as string[], isLoading: true }
+}
diff --git a/frontend/src/features/ontology/components/OntologyBrowser.tsx b/frontend/src/features/ontology/components/OntologyBrowser.tsx
new file mode 100644
index 0000000..9ebe701
--- /dev/null
+++ b/frontend/src/features/ontology/components/OntologyBrowser.tsx
@@ -0,0 +1,3 @@
+export function OntologyBrowser() {
+  return <div>OntologyBrowser placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/OntologyBrowserContext.tsx b/frontend/src/features/ontology/components/OntologyBrowserContext.tsx
new file mode 100644
index 0000000..2fca735
--- /dev/null
+++ b/frontend/src/features/ontology/components/OntologyBrowserContext.tsx
@@ -0,0 +1,20 @@
+import { createContext, useContext } from 'react'
+
+export interface OntologyBrowserContextValue {
+  selectedClassId: string | null
+  setSelectedClassId: (id: string | null) => void
+  labelMode: 'name' | 'description'
+  toggleLabelMode: () => void
+}
+
+export const OntologyBrowserContext =
+  createContext<OntologyBrowserContextValue | null>(null)
+
+export function useOntologyBrowser(): OntologyBrowserContextValue {
+  const ctx = useContext(OntologyBrowserContext)
+  if (!ctx)
+    throw new Error(
+      'useOntologyBrowser must be used within OntologyBrowserProvider',
+    )
+  return ctx
+}
diff --git a/frontend/src/features/ontology/components/shared/ClassLink.tsx b/frontend/src/features/ontology/components/shared/ClassLink.tsx
new file mode 100644
index 0000000..6425515
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/ClassLink.tsx
@@ -0,0 +1,3 @@
+export function ClassLink() {
+  return <div>ClassLink placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/shared/ConflictBadge.tsx b/frontend/src/features/ontology/components/shared/ConflictBadge.tsx
new file mode 100644
index 0000000..c5fd79c
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/ConflictBadge.tsx
@@ -0,0 +1,3 @@
+export function ConflictBadge() {
+  return <div>ConflictBadge placeholder</div>
+}
diff --git a/frontend/src/features/ontology/components/shared/SourceBadge.tsx b/frontend/src/features/ontology/components/shared/SourceBadge.tsx
new file mode 100644
index 0000000..025337d
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/SourceBadge.tsx
@@ -0,0 +1,3 @@
+export function SourceBadge() {
+  return <div>SourceBadge placeholder</div>
+}
diff --git a/frontend/src/routeTree.gen.ts b/frontend/src/routeTree.gen.ts
index ad6960a..878bbd8 100644
--- a/frontend/src/routeTree.gen.ts
+++ b/frontend/src/routeTree.gen.ts
@@ -55,6 +55,7 @@ import { Route as AdminRolesDelegationRouteImport } from './routes/admin/roles/d
 import { Route as AdminOntologyVersionsRouteImport } from './routes/admin/ontology/versions'
 import { Route as AdminOntologyDesignerRouteImport } from './routes/admin/ontology/designer'
 import { Route as AdminOntologyContextsRouteImport } from './routes/admin/ontology/contexts'
+import { Route as AdminOntologyBrowserRouteImport } from './routes/admin/ontology/browser'
 import { Route as AdminOntologyRelationshipsRouteImport } from './routes/admin/ontology/Relationships'
 import { Route as AdminOntologyGraphRouteImport } from './routes/admin/ontology/Graph'
 import { Route as AdminOntologyClassesRouteImport } from './routes/admin/ontology/Classes'
@@ -296,6 +297,11 @@ const AdminOntologyContextsRoute = AdminOntologyContextsRouteImport.update({
   path: '/contexts',
   getParentRoute: () => AdminOntologyRoute,
 } as any)
+const AdminOntologyBrowserRoute = AdminOntologyBrowserRouteImport.update({
+  id: '/browser',
+  path: '/browser',
+  getParentRoute: () => AdminOntologyRoute,
+} as any)
 const AdminOntologyRelationshipsRoute =
   AdminOntologyRelationshipsRouteImport.update({
     id: '/Relationships',
@@ -393,6 +399,7 @@ export interface FileRoutesByFullPath {
   '/admin/ontology/Classes': typeof AdminOntologyClassesRoute
   '/admin/ontology/Graph': typeof AdminOntologyGraphRoute
   '/admin/ontology/Relationships': typeof AdminOntologyRelationshipsRoute
+  '/admin/ontology/browser': typeof AdminOntologyBrowserRoute
   '/admin/ontology/contexts': typeof AdminOntologyContextsRoute
   '/admin/ontology/designer': typeof AdminOntologyDesignerRoute
   '/admin/ontology/versions': typeof AdminOntologyVersionsRoute
@@ -403,8 +410,8 @@ export interface FileRoutesByFullPath {
   '/admin/access/': typeof AdminAccessIndexRoute
   '/admin/discovery/': typeof AdminDiscoveryIndexRoute
   '/admin/ontology/': typeof AdminOntologyIndexRoute
-  '/targeting/ops': typeof TargetingOpsIndexRoute
-  '/targeting/planning': typeof TargetingPlanningIndexRoute
+  '/targeting/ops/': typeof TargetingOpsIndexRoute
+  '/targeting/planning/': typeof TargetingPlanningIndexRoute
 }
 export interface FileRoutesByTo {
   '/': typeof IndexRoute
@@ -445,6 +452,7 @@ export interface FileRoutesByTo {
   '/admin/ontology/Classes': typeof AdminOntologyClassesRoute
   '/admin/ontology/Graph': typeof AdminOntologyGraphRoute
   '/admin/ontology/Relationships': typeof AdminOntologyRelationshipsRoute
+  '/admin/ontology/browser': typeof AdminOntologyBrowserRoute
   '/admin/ontology/contexts': typeof AdminOntologyContextsRoute
   '/admin/ontology/designer': typeof AdminOntologyDesignerRoute
   '/admin/ontology/versions': typeof AdminOntologyVersionsRoute
@@ -504,6 +512,7 @@ export interface FileRoutesById {
   '/admin/ontology/Classes': typeof AdminOntologyClassesRoute
   '/admin/ontology/Graph': typeof AdminOntologyGraphRoute
   '/admin/ontology/Relationships': typeof AdminOntologyRelationshipsRoute
+  '/admin/ontology/browser': typeof AdminOntologyBrowserRoute
   '/admin/ontology/contexts': typeof AdminOntologyContextsRoute
   '/admin/ontology/designer': typeof AdminOntologyDesignerRoute
   '/admin/ontology/versions': typeof AdminOntologyVersionsRoute
@@ -564,6 +573,7 @@ export interface FileRouteTypes {
     | '/admin/ontology/Classes'
     | '/admin/ontology/Graph'
     | '/admin/ontology/Relationships'
+    | '/admin/ontology/browser'
     | '/admin/ontology/contexts'
     | '/admin/ontology/designer'
     | '/admin/ontology/versions'
@@ -574,8 +584,8 @@ export interface FileRouteTypes {
     | '/admin/access/'
     | '/admin/discovery/'
     | '/admin/ontology/'
-    | '/targeting/ops'
-    | '/targeting/planning'
+    | '/targeting/ops/'
+    | '/targeting/planning/'
   fileRoutesByTo: FileRoutesByTo
   to:
     | '/'
@@ -616,6 +626,7 @@ export interface FileRouteTypes {
     | '/admin/ontology/Classes'
     | '/admin/ontology/Graph'
     | '/admin/ontology/Relationships'
+    | '/admin/ontology/browser'
     | '/admin/ontology/contexts'
     | '/admin/ontology/designer'
     | '/admin/ontology/versions'
@@ -674,6 +685,7 @@ export interface FileRouteTypes {
     | '/admin/ontology/Classes'
     | '/admin/ontology/Graph'
     | '/admin/ontology/Relationships'
+    | '/admin/ontology/browser'
     | '/admin/ontology/contexts'
     | '/admin/ontology/designer'
     | '/admin/ontology/versions'
@@ -952,14 +964,14 @@ declare module '@tanstack/react-router' {
     '/targeting/planning/': {
       id: '/targeting/planning/'
       path: '/planning'
-      fullPath: '/targeting/planning'
+      fullPath: '/targeting/planning/'
       preLoaderRoute: typeof TargetingPlanningIndexRouteImport
       parentRoute: typeof TargetingRoute
     }
     '/targeting/ops/': {
       id: '/targeting/ops/'
       path: '/ops'
-      fullPath: '/targeting/ops'
+      fullPath: '/targeting/ops/'
       preLoaderRoute: typeof TargetingOpsIndexRouteImport
       parentRoute: typeof TargetingRoute
     }
@@ -1033,6 +1045,13 @@ declare module '@tanstack/react-router' {
       preLoaderRoute: typeof AdminOntologyContextsRouteImport
       parentRoute: typeof AdminOntologyRoute
     }
+    '/admin/ontology/browser': {
+      id: '/admin/ontology/browser'
+      path: '/browser'
+      fullPath: '/admin/ontology/browser'
+      preLoaderRoute: typeof AdminOntologyBrowserRouteImport
+      parentRoute: typeof AdminOntologyRoute
+    }
     '/admin/ontology/Relationships': {
       id: '/admin/ontology/Relationships'
       path: '/Relationships'
@@ -1148,6 +1167,7 @@ interface AdminOntologyRouteChildren {
   AdminOntologyClassesRoute: typeof AdminOntologyClassesRoute
   AdminOntologyGraphRoute: typeof AdminOntologyGraphRoute
   AdminOntologyRelationshipsRoute: typeof AdminOntologyRelationshipsRoute
+  AdminOntologyBrowserRoute: typeof AdminOntologyBrowserRoute
   AdminOntologyContextsRoute: typeof AdminOntologyContextsRoute
   AdminOntologyDesignerRoute: typeof AdminOntologyDesignerRoute
   AdminOntologyVersionsRoute: typeof AdminOntologyVersionsRoute
@@ -1158,6 +1178,7 @@ const AdminOntologyRouteChildren: AdminOntologyRouteChildren = {
   AdminOntologyClassesRoute: AdminOntologyClassesRoute,
   AdminOntologyGraphRoute: AdminOntologyGraphRoute,
   AdminOntologyRelationshipsRoute: AdminOntologyRelationshipsRoute,
+  AdminOntologyBrowserRoute: AdminOntologyBrowserRoute,
   AdminOntologyContextsRoute: AdminOntologyContextsRoute,
   AdminOntologyDesignerRoute: AdminOntologyDesignerRoute,
   AdminOntologyVersionsRoute: AdminOntologyVersionsRoute,
diff --git a/frontend/src/routes/admin/ontology/browser.tsx b/frontend/src/routes/admin/ontology/browser.tsx
new file mode 100644
index 0000000..b900c12
--- /dev/null
+++ b/frontend/src/routes/admin/ontology/browser.tsx
@@ -0,0 +1,10 @@
+import { createFileRoute } from '@tanstack/react-router'
+
+export const Route = createFileRoute('/admin/ontology/browser')({
+  component: OntologyBrowserPage,
+})
+
+function OntologyBrowserPage() {
+  // Placeholder until Section 03 implements OntologyBrowser
+  return <div>Ontology Browser</div>
+}
