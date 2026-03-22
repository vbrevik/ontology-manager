diff --git a/docs/requirements/03-ontology-browser/implementation/contracts/section-03-contract.md b/docs/requirements/03-ontology-browser/implementation/contracts/section-03-contract.md
new file mode 100644
index 0000000..7bd2a83
--- /dev/null
+++ b/docs/requirements/03-ontology-browser/implementation/contracts/section-03-contract.md
@@ -0,0 +1,31 @@
+# Section 03: Layout and Context — Prompt Contract
+
+## GOAL
+Implement the OntologyBrowser layout component with resizable panels and the OntologyBrowserContext that provides shared state (selected class ID, label mode) across the browser. Connect the context to the data layer for stale selection recovery.
+
+## CONTEXT
+Section 03 bridges the route infrastructure (section 01) and data layer (section 02) with the UI layout that sections 04-09 will build upon. The resizable split-panel layout and shared context are foundational — every subsequent section depends on them.
+
+## CONSTRAINTS
+- Use existing Shadcn resizable wrappers from `@/components/ui/resizable`
+- Use existing `useClassTree` hook from section 02 for class list data
+- Follow TDD: write tests first, then implementation
+- React default JSX escaping only — no raw HTML rendering (V-222602)
+- Handle malformed localStorage values gracefully without crashing (V-222609)
+- Error boundaries must isolate panel failures independently
+
+## FORMAT — Files to create/modify
+- `frontend/src/features/ontology/components/OntologyBrowserContext.tsx` (modify existing scaffold)
+- `frontend/src/features/ontology/components/OntologyBrowser.tsx` (modify existing scaffold)
+- `frontend/src/features/ontology/components/OntologyBrowserContext.test.tsx` (new)
+- `frontend/src/features/ontology/components/OntologyBrowser.test.tsx` (new)
+- `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` (update stub)
+- `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx` (update stub)
+- `frontend/src/routes/admin/ontology/browser.tsx` (wire OntologyBrowser component)
+
+## FAILURE CONDITIONS
+- SHALL NOT skip any of the 11 specified test cases
+- SHALL NOT use raw HTML rendering or bypass React escaping
+- SHALL NOT crash on malformed localStorage values
+- SHALL NOT allow error in one panel to crash the other panel
+- SHALL NOT violate STIG controls V-222602, V-222609
diff --git a/frontend/src/components/ui/resizable.tsx b/frontend/src/components/ui/resizable.tsx
index 079dcdd..1d4e8c5 100644
--- a/frontend/src/components/ui/resizable.tsx
+++ b/frontend/src/components/ui/resizable.tsx
@@ -2,15 +2,15 @@
 
 import * as React from "react"
 import { GripVertical } from "lucide-react"
-import * as ResizablePrimitive from "react-resizable-panels"
+import { Group, Panel, Separator } from "react-resizable-panels"
 
 import { cn } from "@/lib/utils"
 
 const ResizablePanelGroup = ({
     className,
     ...props
-}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
-    <ResizablePrimitive.PanelGroup
+}: React.ComponentProps<typeof Group>) => (
+    <Group
         className={cn(
             "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
             className
@@ -19,16 +19,16 @@ const ResizablePanelGroup = ({
     />
 )
 
-const ResizablePanel = ResizablePrimitive.Panel
+const ResizablePanel = Panel
 
 const ResizableHandle = ({
     withHandle,
     className,
     ...props
-}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
+}: React.ComponentProps<typeof Separator> & {
     withHandle?: boolean
 }) => (
-    <ResizablePrimitive.PanelResizeHandle
+    <Separator
         className={cn(
             "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
             className
@@ -40,7 +40,7 @@ const ResizableHandle = ({
                 <GripVertical className="h-2.5 w-2.5" />
             </div>
         )}
-    </ResizablePrimitive.PanelResizeHandle>
+    </Separator>
 )
 
 export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
diff --git a/frontend/src/components/ui/use-toast.tsx b/frontend/src/components/ui/use-toast.tsx
index 9276478..7bc25a5 100644
--- a/frontend/src/components/ui/use-toast.tsx
+++ b/frontend/src/components/ui/use-toast.tsx
@@ -1,19 +1,23 @@
-import { } from 'react'
+import { useToastContext, type ToastVariant } from './toast'
 
 export interface ToastProps {
     title?: string
     description?: string
-    variant?: 'default' | 'destructive'
+    variant?: ToastVariant
+    duration?: number
 }
 
 export function useToast() {
-    const toast = ({ title, description, variant }: ToastProps) => {
-        console.log(`[Toast] ${variant === 'destructive' ? '❌' : '✅'} ${title}: ${description}`)
-        // Real implementation would use a toast provider
-        if (typeof window !== 'undefined') {
-            alert(`${title}\n${description}`)
-        }
+    const { toast } = useToastContext()
+
+    const toastFn = ({ title, description, variant = 'default', duration }: ToastProps) => {
+        toast({
+            title: title ?? '',
+            description,
+            variant,
+            duration,
+        })
     }
 
-    return { toast }
+    return { toast: toastFn }
 }
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
index 2c5cf4d..cfa705e 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx
@@ -1,3 +1,7 @@
 export function ClassDetail() {
-  return <div>ClassDetail placeholder</div>
+  return (
+    <div data-testid="class-detail" className="h-full overflow-auto p-4">
+      Select a class to view details
+    </div>
+  )
 }
diff --git a/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx b/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
index 0385934..9efe98c 100644
--- a/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
+++ b/frontend/src/features/ontology/components/ClassTree/ClassTree.tsx
@@ -1,3 +1,7 @@
 export function ClassTree() {
-  return <div>ClassTree placeholder</div>
+  return (
+    <div data-testid="class-tree" className="h-full overflow-auto p-2">
+      Class tree loading...
+    </div>
+  )
 }
diff --git a/frontend/src/features/ontology/components/OntologyBrowser.test.tsx b/frontend/src/features/ontology/components/OntologyBrowser.test.tsx
new file mode 100644
index 0000000..a5a891f
--- /dev/null
+++ b/frontend/src/features/ontology/components/OntologyBrowser.test.tsx
@@ -0,0 +1,125 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { render, screen } from '@testing-library/react'
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
+
+// Flags to control mock behavior
+let classTreeShouldThrow = false
+let classDetailShouldThrow = false
+
+// Mock the data layer hook
+vi.mock('./ClassTree/useClassTree', () => ({
+  useClassTree: () => ({
+    treeData: undefined,
+    classList: [],
+    isLoading: false,
+    error: null,
+    searchText: '',
+    setSearchText: vi.fn(),
+    sourceFilter: null,
+    setSourceFilter: vi.fn(),
+    availableSources: [],
+  }),
+}))
+
+// Mock resizable panels — they require ResizeObserver not available in jsdom
+vi.mock('@/components/ui/resizable', () => ({
+  ResizablePanelGroup: ({ children }: any) => (
+    <div data-testid="panel-group">{children}</div>
+  ),
+  ResizablePanel: ({
+    children,
+    'data-testid': testId,
+  }: any) => <div data-testid={testId}>{children}</div>,
+  ResizableHandle: ({ children }: any) => (
+    <div data-testid="resize-handle">{children}</div>
+  ),
+}))
+
+// Mock ClassTree — conditionally throws for error boundary testing
+vi.mock('./ClassTree/ClassTree', () => ({
+  ClassTree: () => {
+    if (classTreeShouldThrow) throw new Error('ClassTree crash')
+    return <div data-testid="class-tree">ClassTree mock</div>
+  },
+}))
+
+// Mock ClassDetail — conditionally throws for error boundary testing
+vi.mock('./ClassDetail/ClassDetail', () => ({
+  ClassDetail: () => {
+    if (classDetailShouldThrow) throw new Error('ClassDetail crash')
+    return <div data-testid="class-detail">ClassDetail mock</div>
+  },
+}))
+
+import { OntologyBrowser } from './OntologyBrowser'
+
+function renderWithProviders() {
+  const queryClient = new QueryClient({
+    defaultOptions: { queries: { retry: false } },
+  })
+  return render(
+    <QueryClientProvider client={queryClient}>
+      <OntologyBrowser />
+    </QueryClientProvider>,
+  )
+}
+
+describe('OntologyBrowser', () => {
+  beforeEach(() => {
+    localStorage.clear()
+    classTreeShouldThrow = false
+    classDetailShouldThrow = false
+  })
+
+  it('renders PanelGroup with two panels', () => {
+    renderWithProviders()
+
+    expect(screen.getByTestId('tree-panel')).toBeInTheDocument()
+    expect(screen.getByTestId('detail-panel')).toBeInTheDocument()
+  })
+
+  it('left panel contains ClassTree', () => {
+    renderWithProviders()
+
+    const treePanel = screen.getByTestId('tree-panel')
+    expect(treePanel).toContainElement(screen.getByTestId('class-tree'))
+  })
+
+  it('right panel contains ClassDetail', () => {
+    renderWithProviders()
+
+    const detailPanel = screen.getByTestId('detail-panel')
+    expect(detailPanel).toContainElement(screen.getByTestId('class-detail'))
+  })
+
+  it('wraps children in OntologyBrowserContext provider', () => {
+    renderWithProviders()
+
+    expect(screen.getByTestId('class-tree')).toBeInTheDocument()
+    expect(screen.getByTestId('class-detail')).toBeInTheDocument()
+  })
+
+  it('error boundary in tree panel catches errors without crashing detail panel', () => {
+    classTreeShouldThrow = true
+    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+
+    renderWithProviders()
+
+    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
+    expect(screen.getByTestId('class-detail')).toBeInTheDocument()
+
+    consoleSpy.mockRestore()
+  })
+
+  it('error boundary in detail panel catches errors without crashing tree panel', () => {
+    classDetailShouldThrow = true
+    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+
+    renderWithProviders()
+
+    expect(screen.getByTestId('class-tree')).toBeInTheDocument()
+    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
+
+    consoleSpy.mockRestore()
+  })
+})
diff --git a/frontend/src/features/ontology/components/OntologyBrowser.tsx b/frontend/src/features/ontology/components/OntologyBrowser.tsx
index 9ebe701..8ed9b5f 100644
--- a/frontend/src/features/ontology/components/OntologyBrowser.tsx
+++ b/frontend/src/features/ontology/components/OntologyBrowser.tsx
@@ -1,3 +1,118 @@
+import { Component, useRef, type ReactNode } from 'react'
+import { ChevronLeft } from 'lucide-react'
+import type { PanelImperativeHandle } from 'react-resizable-panels'
+import {
+  ResizablePanelGroup,
+  ResizablePanel,
+  ResizableHandle,
+} from '@/components/ui/resizable'
+import { Button } from '@/components/ui/button'
+import { OntologyBrowserProvider } from './OntologyBrowserContext'
+import { useClassTree } from './ClassTree/useClassTree'
+import { ClassTree } from './ClassTree/ClassTree'
+import { ClassDetail } from './ClassDetail/ClassDetail'
+
+// --- Error Boundary ---
+
+interface ErrorBoundaryProps {
+  children: ReactNode
+  fallback?: ReactNode
+}
+
+interface ErrorBoundaryState {
+  hasError: boolean
+}
+
+class PanelErrorBoundary extends Component<
+  ErrorBoundaryProps,
+  ErrorBoundaryState
+> {
+  constructor(props: ErrorBoundaryProps) {
+    super(props)
+    this.state = { hasError: false }
+  }
+
+  static getDerivedStateFromError(): ErrorBoundaryState {
+    return { hasError: true }
+  }
+
+  componentDidCatch() {
+    // Error logging can be added here
+  }
+
+  render() {
+    if (this.state.hasError) {
+      return (
+        this.props.fallback ?? (
+          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
+            <p>Something went wrong</p>
+            <Button
+              variant="outline"
+              size="sm"
+              onClick={() => this.setState({ hasError: false })}
+            >
+              Try again
+            </Button>
+          </div>
+        )
+      )
+    }
+    return this.props.children
+  }
+}
+
+// --- Main Layout ---
+
 export function OntologyBrowser() {
-  return <div>OntologyBrowser placeholder</div>
+  const { classList } = useClassTree()
+  const treePanelRef = useRef<PanelImperativeHandle>(null)
+
+  const handleCollapseToggle = () => {
+    const panel = treePanelRef.current
+    if (!panel) return
+    if (panel.isCollapsed()) {
+      panel.expand()
+    } else {
+      panel.collapse()
+    }
+  }
+
+  return (
+    <OntologyBrowserProvider classList={classList}>
+      <ResizablePanelGroup orientation="horizontal">
+        <ResizablePanel
+          panelRef={treePanelRef}
+          id="tree"
+          defaultSize={30}
+          minSize={15}
+          maxSize={50}
+          collapsible
+          collapsedSize={0}
+          data-testid="tree-panel"
+        >
+          <PanelErrorBoundary>
+            <ClassTree />
+          </PanelErrorBoundary>
+        </ResizablePanel>
+
+        <ResizableHandle withHandle>
+          <Button
+            variant="ghost"
+            size="icon"
+            className="absolute z-20 h-6 w-6 rounded-full"
+            onClick={handleCollapseToggle}
+            aria-label="Toggle tree panel"
+          >
+            <ChevronLeft className="h-3 w-3" />
+          </Button>
+        </ResizableHandle>
+
+        <ResizablePanel id="detail" defaultSize={70} data-testid="detail-panel">
+          <PanelErrorBoundary>
+            <ClassDetail />
+          </PanelErrorBoundary>
+        </ResizablePanel>
+      </ResizablePanelGroup>
+    </OntologyBrowserProvider>
+  )
 }
diff --git a/frontend/src/features/ontology/components/OntologyBrowserContext.test.tsx b/frontend/src/features/ontology/components/OntologyBrowserContext.test.tsx
new file mode 100644
index 0000000..a952a6f
--- /dev/null
+++ b/frontend/src/features/ontology/components/OntologyBrowserContext.test.tsx
@@ -0,0 +1,86 @@
+import { describe, it, expect, beforeEach } from 'vitest'
+import { renderHook, act } from '@testing-library/react'
+import type { ReactNode } from 'react'
+import {
+  OntologyBrowserProvider,
+  useOntologyBrowser,
+} from './OntologyBrowserContext'
+
+function createWrapper(classList?: Array<{ id: string }>) {
+  return function Wrapper({ children }: { children: ReactNode }) {
+    return (
+      <OntologyBrowserProvider classList={classList}>
+        {children}
+      </OntologyBrowserProvider>
+    )
+  }
+}
+
+describe('OntologyBrowserContext', () => {
+  beforeEach(() => {
+    localStorage.clear()
+  })
+
+  it('initializes selectedClassId from localStorage if present', () => {
+    localStorage.setItem('ontology-browser-selected', JSON.stringify('some-id'))
+
+    const { result } = renderHook(() => useOntologyBrowser(), {
+      wrapper: createWrapper([{ id: 'some-id' }]),
+    })
+
+    expect(result.current.selectedClassId).toBe('some-id')
+  })
+
+  it('defaults selectedClassId to null if localStorage empty', () => {
+    const { result } = renderHook(() => useOntologyBrowser(), {
+      wrapper: createWrapper(),
+    })
+
+    expect(result.current.selectedClassId).toBeNull()
+  })
+
+  it('persists selectedClassId to localStorage on change', () => {
+    const { result } = renderHook(() => useOntologyBrowser(), {
+      wrapper: createWrapper(),
+    })
+
+    act(() => {
+      result.current.setSelectedClassId('new-id')
+    })
+
+    expect(localStorage.getItem('ontology-browser-selected')).toBe(
+      JSON.stringify('new-id'),
+    )
+  })
+
+  it('clears selectedClassId to null when class not found in class list (stale recovery)', () => {
+    localStorage.setItem(
+      'ontology-browser-selected',
+      JSON.stringify('deleted-class'),
+    )
+
+    const { result } = renderHook(() => useOntologyBrowser(), {
+      wrapper: createWrapper([{ id: 'class-a' }, { id: 'class-b' }]),
+    })
+
+    expect(result.current.selectedClassId).toBeNull()
+  })
+
+  it('provides labelMode and toggleLabelMode', () => {
+    const { result } = renderHook(() => useOntologyBrowser(), {
+      wrapper: createWrapper(),
+    })
+
+    expect(result.current.labelMode).toBe('name')
+
+    act(() => {
+      result.current.toggleLabelMode()
+    })
+    expect(result.current.labelMode).toBe('description')
+
+    act(() => {
+      result.current.toggleLabelMode()
+    })
+    expect(result.current.labelMode).toBe('name')
+  })
+})
diff --git a/frontend/src/features/ontology/components/OntologyBrowserContext.tsx b/frontend/src/features/ontology/components/OntologyBrowserContext.tsx
index 2fca735..080fd1b 100644
--- a/frontend/src/features/ontology/components/OntologyBrowserContext.tsx
+++ b/frontend/src/features/ontology/components/OntologyBrowserContext.tsx
@@ -1,4 +1,11 @@
-import { createContext, useContext } from 'react'
+import {
+  createContext,
+  useContext,
+  useState,
+  useEffect,
+  useCallback,
+  type ReactNode,
+} from 'react'
 
 export interface OntologyBrowserContextValue {
   selectedClassId: string | null
@@ -7,9 +14,88 @@ export interface OntologyBrowserContextValue {
   toggleLabelMode: () => void
 }
 
-export const OntologyBrowserContext =
+const OntologyBrowserContext =
   createContext<OntologyBrowserContextValue | null>(null)
 
+const SELECTED_KEY = 'ontology-browser-selected'
+const LABEL_MODE_KEY = 'ontology-browser-label-mode'
+
+function readSelectedFromStorage(): string | null {
+  try {
+    const raw = localStorage.getItem(SELECTED_KEY)
+    if (raw === null) return null
+    const parsed = JSON.parse(raw)
+    return typeof parsed === 'string' ? parsed : null
+  } catch {
+    return null
+  }
+}
+
+function readLabelModeFromStorage(): 'name' | 'description' {
+  try {
+    const raw = localStorage.getItem(LABEL_MODE_KEY)
+    if (raw === 'description') return 'description'
+    return 'name'
+  } catch {
+    return 'name'
+  }
+}
+
+interface OntologyBrowserProviderProps {
+  children: ReactNode
+  classList?: Array<{ id: string }>
+}
+
+export function OntologyBrowserProvider({
+  children,
+  classList,
+}: OntologyBrowserProviderProps) {
+  const [selectedClassId, setSelectedClassId] = useState<string | null>(
+    readSelectedFromStorage,
+  )
+  const [labelMode, setLabelMode] = useState<'name' | 'description'>(
+    readLabelModeFromStorage,
+  )
+
+  // Persist selectedClassId to localStorage
+  useEffect(() => {
+    if (selectedClassId === null) {
+      localStorage.removeItem(SELECTED_KEY)
+    } else {
+      localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedClassId))
+    }
+  }, [selectedClassId])
+
+  // Persist labelMode to localStorage
+  useEffect(() => {
+    localStorage.setItem(LABEL_MODE_KEY, labelMode)
+  }, [labelMode])
+
+  // Stale selection recovery: clear selectedClassId if not in class list
+  useEffect(() => {
+    if (
+      selectedClassId !== null &&
+      classList &&
+      classList.length > 0 &&
+      !classList.some((cls) => cls.id === selectedClassId)
+    ) {
+      setSelectedClassId(null)
+    }
+  }, [classList, selectedClassId])
+
+  const toggleLabelMode = useCallback(() => {
+    setLabelMode((prev) => (prev === 'name' ? 'description' : 'name'))
+  }, [])
+
+  return (
+    <OntologyBrowserContext.Provider
+      value={{ selectedClassId, setSelectedClassId, labelMode, toggleLabelMode }}
+    >
+      {children}
+    </OntologyBrowserContext.Provider>
+  )
+}
+
 export function useOntologyBrowser(): OntologyBrowserContextValue {
   const ctx = useContext(OntologyBrowserContext)
   if (!ctx)
diff --git a/frontend/src/routes/__root.tsx b/frontend/src/routes/__root.tsx
index e12a4cf..0cdf582 100644
--- a/frontend/src/routes/__root.tsx
+++ b/frontend/src/routes/__root.tsx
@@ -9,20 +9,22 @@ import { FirefighterBanner } from '@/components/firefighter/FirefighterBanner'
 import { AuthProvider } from "@/features/auth/lib/context";
 import { AiProvider } from "@/features/ai/lib/context";
 import { ContextProvider } from "@/features/context/context-provider";
+import { ToastProvider } from "@/components/ui/toast";
 
 export const Route = createRootRoute({
   component: () => (
-    <AuthProvider>
-      <AiProvider>
-        <ContextProvider>
-          <div className="flex flex-col min-h-screen bg-background text-foreground">
-            <Navbar />
-            <Breadcrumbs />
-            <main className="flex-1">
-              <Outlet />
-            </main>
-            <FirefighterBanner />
-            <Footer />
+    <ToastProvider>
+      <AuthProvider>
+        <AiProvider>
+          <ContextProvider>
+            <div className="flex flex-col min-h-screen bg-background text-foreground">
+              <Navbar />
+              <Breadcrumbs />
+              <main className="flex-1">
+                <Outlet />
+              </main>
+              <FirefighterBanner />
+              <Footer />
             <TanStackDevtools
               config={{
                 position: 'bottom-right',
@@ -34,9 +36,10 @@ export const Route = createRootRoute({
                 },
               ]}
             />
-          </div>
-        </ContextProvider>
-      </AiProvider>
-    </AuthProvider>
+            </div>
+          </ContextProvider>
+        </AiProvider>
+      </AuthProvider>
+    </ToastProvider>
   ),
 })
diff --git a/frontend/src/routes/admin/ontology/browser.tsx b/frontend/src/routes/admin/ontology/browser.tsx
index b900c12..19a2551 100644
--- a/frontend/src/routes/admin/ontology/browser.tsx
+++ b/frontend/src/routes/admin/ontology/browser.tsx
@@ -1,10 +1,10 @@
 import { createFileRoute } from '@tanstack/react-router'
+import { OntologyBrowser } from '@/features/ontology/components/OntologyBrowser'
 
 export const Route = createFileRoute('/admin/ontology/browser')({
   component: OntologyBrowserPage,
 })
 
 function OntologyBrowserPage() {
-  // Placeholder until Section 03 implements OntologyBrowser
-  return <div>Ontology Browser</div>
+  return <OntologyBrowser />
 }
diff --git a/frontend/src/routes/profile.tsx b/frontend/src/routes/profile.tsx
index 1b99289..29e999f 100644
--- a/frontend/src/routes/profile.tsx
+++ b/frontend/src/routes/profile.tsx
@@ -4,10 +4,10 @@ import { getUserInfo, changePassword, updateProfile, listSessions, revokeSession
 import { Button } from '@/components/ui/button'
 import { Input } from '@/components/ui/input'
 import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
-import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
-import { User, Lock, Mail, AlertCircle, CheckCircle2, Shield, Smartphone, Laptop, Trash2 } from 'lucide-react'
+import { User, Lock, Mail, Shield, Smartphone, Laptop, Trash2 } from 'lucide-react'
 import { getPasswordStrength } from '@/lib/password'
 import { MfaSetup } from '@/features/auth/components/MfaSetup'
+import { useToast } from '@/components/ui/use-toast'
 
 export const Route = createFileRoute('/profile')({
   component: Profile,
@@ -21,12 +21,11 @@ function Profile() {
   const [currentPassword, setCurrentPassword] = useState('')
   const [newPassword, setNewPassword] = useState('')
   const [confirmPassword, setConfirmPassword] = useState('')
-  const [message, setMessage] = useState<string | null>(null)
-  const [isSuccess, setIsSuccess] = useState(false)
   const [loading, setLoading] = useState(false)
   const [profileLoading, setProfileLoading] = useState(false)
   const [sessions, setSessions] = useState<Session[]>([])
   const [sessionsLoading, setSessionsLoading] = useState(false)
+  const { toast } = useToast()
 
   useEffect(() => {
     let mounted = true
@@ -52,11 +51,9 @@ function Profile() {
 
   async function onUpdateProfile(e: React.FormEvent) {
     e.preventDefault()
-    setMessage(null)
-    setIsSuccess(false)
 
     if (!editUsername.trim()) {
-      setMessage('Username cannot be empty')
+      toast({ variant: 'warning', title: 'Validation Error', description: 'Username cannot be empty' })
       return
     }
 
@@ -65,26 +62,23 @@ function Profile() {
     setProfileLoading(false)
 
     if (res.success) {
-      setIsSuccess(true)
-      setMessage('Profile updated successfully')
+      toast({ variant: 'success', title: 'Profile Updated', description: 'Your username has been saved successfully.' })
       setUsername(editUsername)
       setIsEditing(false)
     } else {
-      setMessage(res.error || 'Failed to update profile')
+      toast({ variant: 'destructive', title: 'Update Failed', description: res.error || 'Failed to update profile' })
     }
   }
 
   async function onUpdatePassword(e: React.FormEvent) {
     e.preventDefault()
-    setMessage(null)
-    setIsSuccess(false)
 
     if (newPassword !== confirmPassword) {
-      setMessage('New password and confirmation do not match')
+      toast({ variant: 'warning', title: 'Validation Error', description: 'New password and confirmation do not match' })
       return
     }
     if (newPassword.length < 8) {
-      setMessage('Password must be at least 8 characters')
+      toast({ variant: 'warning', title: 'Validation Error', description: 'Password must be at least 8 characters' })
       return
     }
 
@@ -93,22 +87,22 @@ function Profile() {
     setLoading(false)
 
     if (res.success) {
-      setIsSuccess(true)
-      setMessage('Password changed successfully')
+      toast({ variant: 'success', title: 'Password Changed', description: 'Your password has been updated successfully.' })
       setCurrentPassword('')
       setNewPassword('')
       setConfirmPassword('')
     } else {
-      setMessage(res.error || 'Failed to change password')
+      toast({ variant: 'destructive', title: 'Password Change Failed', description: res.error || 'Failed to change password' })
     }
   }
 
   async function onRevokeSession(id: string) {
     const res = await revokeSession(id)
     if (res.success) {
+      toast({ variant: 'success', title: 'Session Revoked', description: 'The session has been removed from your account.' })
       setSessions(sessions.filter(s => s.id !== id))
     } else {
-      setMessage(res.error || 'Failed to revoke session')
+      toast({ variant: 'destructive', title: 'Revoke Failed', description: res.error || 'Failed to revoke session' })
     }
   }
 
@@ -120,24 +114,6 @@ function Profile() {
         <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
       </div>
 
-      {message && (
-        <div className="animate-in slide-in-from-top-2 duration-300">
-          {isSuccess ? (
-            <Alert className="mb-6 py-3 px-4 text-sm border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
-              <CheckCircle2 className="h-4 w-4" />
-              <AlertTitle className="text-xs uppercase font-bold tracking-wider">Success</AlertTitle>
-              <AlertDescription className="text-xs">{message}</AlertDescription>
-            </Alert>
-          ) : (
-            <Alert variant="destructive" className="mb-6 py-3 px-4 text-sm">
-              <AlertCircle className="h-4 w-4" />
-              <AlertTitle className="text-xs uppercase font-bold tracking-wider">Error</AlertTitle>
-              <AlertDescription className="text-xs">{message}</AlertDescription>
-            </Alert>
-          )}
-        </div>
-      )}
-
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Account Information Card */}
         <Card className="border-border/40 overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
@@ -346,7 +322,6 @@ function Profile() {
                   setCurrentPassword('')
                   setNewPassword('')
                   setConfirmPassword('')
-                  setMessage(null)
                 }}
                 className="h-10 text-xs font-bold uppercase tracking-widest"
               >
