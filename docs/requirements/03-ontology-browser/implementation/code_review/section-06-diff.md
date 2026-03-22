diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx
index 91aa3e2..5a04a5f 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx
@@ -55,8 +55,8 @@ vi.mock('../shared/SourceBadge', () => ({
   ),
 }))
 vi.mock('../shared/ClassLink', () => ({
-  ClassLink: ({ children }: { children: React.ReactNode }) => (
-    <span data-testid="class-link">{children}</span>
+  ClassLink: ({ label }: { label: string }) => (
+    <span data-testid="class-link">{label}</span>
   ),
 }))
 
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx
index a65a28e..9152604 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.test.tsx
@@ -10,8 +10,8 @@ vi.mock('../shared/SourceBadge', () => ({
 }))
 
 vi.mock('../shared/ClassLink', () => ({
-  ClassLink: ({ children }: { children: React.ReactNode }) => (
-    <span data-testid="class-link">{children}</span>
+  ClassLink: ({ label }: { label: string }) => (
+    <span data-testid="class-link">{label}</span>
   ),
 }))
 
diff --git a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
index 2d2abfe..94420f2 100644
--- a/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
+++ b/frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx
@@ -44,9 +44,7 @@ export function ClassHeader({
       {classData.parent_class_id && parentClassName && (
         <div className="text-sm text-muted-foreground">
           Parent:{' '}
-          <ClassLink classId={classData.parent_class_id}>
-            {parentClassName}
-          </ClassLink>
+          <ClassLink classId={classData.parent_class_id} label={parentClassName} />
         </div>
       )}
 
diff --git a/frontend/src/features/ontology/components/shared/ClassLink.test.tsx b/frontend/src/features/ontology/components/shared/ClassLink.test.tsx
new file mode 100644
index 0000000..fba4fb2
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/ClassLink.test.tsx
@@ -0,0 +1,32 @@
+import { describe, it, expect, vi } from 'vitest'
+import { render, screen, fireEvent } from '@testing-library/react'
+import { ClassLink } from './ClassLink'
+
+describe('ClassLink', () => {
+  it('renders class name as link text', () => {
+    render(<ClassLink classId="123" label="Vehicle" />)
+    expect(screen.getByText('Vehicle')).toBeInTheDocument()
+  })
+
+  it('clicking calls onNavigate with correct classId', () => {
+    const onNavigate = vi.fn()
+    render(
+      <ClassLink classId="123" label="Vehicle" onNavigate={onNavigate} />,
+    )
+    fireEvent.click(screen.getByText('Vehicle'))
+    expect(onNavigate).toHaveBeenCalledWith('123')
+  })
+
+  it('has correct styling classes', () => {
+    render(<ClassLink classId="123" label="Vehicle" />)
+    const button = screen.getByRole('button')
+    expect(button.className).toContain('text-primary')
+    expect(button.className).toContain('underline-offset-4')
+    expect(button.className).toContain('hover:underline')
+  })
+
+  it('renders as a button element', () => {
+    render(<ClassLink classId="123" label="Vehicle" />)
+    expect(screen.getByRole('button')).toBeInTheDocument()
+  })
+})
diff --git a/frontend/src/features/ontology/components/shared/ClassLink.tsx b/frontend/src/features/ontology/components/shared/ClassLink.tsx
index d991d70..c6e2723 100644
--- a/frontend/src/features/ontology/components/shared/ClassLink.tsx
+++ b/frontend/src/features/ontology/components/shared/ClassLink.tsx
@@ -1,17 +1,18 @@
-interface ClassLinkProps {
+export interface ClassLinkProps {
   classId: string
-  className?: string
-  children: React.ReactNode
+  label: string
+  onNavigate?: (classId: string) => void
 }
 
-export function ClassLink({ classId, children }: ClassLinkProps) {
+export function ClassLink({ classId, label, onNavigate }: ClassLinkProps) {
   return (
     <button
-      className="text-sm text-primary underline-offset-4 hover:underline"
+      className="bg-transparent border-none p-0 font-inherit text-sm text-primary underline-offset-4 hover:underline cursor-pointer"
       data-testid="class-link"
       data-class-id={classId}
+      onClick={onNavigate ? () => onNavigate(classId) : undefined}
     >
-      {children}
+      {label}
     </button>
   )
 }
diff --git a/frontend/src/features/ontology/components/shared/ConflictBadge.test.tsx b/frontend/src/features/ontology/components/shared/ConflictBadge.test.tsx
new file mode 100644
index 0000000..4ad32be
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/ConflictBadge.test.tsx
@@ -0,0 +1,32 @@
+import { describe, it, expect } from 'vitest'
+import { render, screen } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { ConflictBadge } from './ConflictBadge'
+import { TooltipProvider } from '@/components/ui/tooltip'
+
+describe('ConflictBadge', () => {
+  it('renders AlertTriangle icon', () => {
+    render(
+      <TooltipProvider>
+        <ConflictBadge />
+      </TooltipProvider>,
+    )
+    expect(screen.getByTestId('conflict-badge')).toBeInTheDocument()
+    const svg = screen.getByTestId('conflict-badge').querySelector('svg')
+    expect(svg).not.toBeNull()
+  })
+
+  it('shows tooltip on hover', async () => {
+    const user = userEvent.setup()
+    render(
+      <TooltipProvider delayDuration={0}>
+        <ConflictBadge />
+      </TooltipProvider>,
+    )
+    await user.hover(screen.getByTestId('conflict-badge'))
+    const matches = await screen.findAllByText(
+      'This class has conflicting definitions from multiple sources.',
+    )
+    expect(matches.length).toBeGreaterThan(0)
+  })
+})
diff --git a/frontend/src/features/ontology/components/shared/ConflictBadge.tsx b/frontend/src/features/ontology/components/shared/ConflictBadge.tsx
index c5fd79c..4e23b79 100644
--- a/frontend/src/features/ontology/components/shared/ConflictBadge.tsx
+++ b/frontend/src/features/ontology/components/shared/ConflictBadge.tsx
@@ -1,3 +1,26 @@
-export function ConflictBadge() {
-  return <div>ConflictBadge placeholder</div>
+import { AlertTriangle } from 'lucide-react'
+import {
+  Tooltip,
+  TooltipTrigger,
+  TooltipContent,
+} from '@/components/ui/tooltip'
+import { cn } from '@/lib/utils'
+
+interface ConflictBadgeProps {
+  className?: string
+}
+
+export function ConflictBadge({ className }: ConflictBadgeProps) {
+  return (
+    <Tooltip>
+      <TooltipTrigger asChild>
+        <span data-testid="conflict-badge" className={cn('inline-flex', className)}>
+          <AlertTriangle className="h-4 w-4 text-amber-500" />
+        </span>
+      </TooltipTrigger>
+      <TooltipContent>
+        This class has conflicting definitions from multiple sources.
+      </TooltipContent>
+    </Tooltip>
+  )
 }
diff --git a/frontend/src/features/ontology/components/shared/SourceBadge.test.tsx b/frontend/src/features/ontology/components/shared/SourceBadge.test.tsx
new file mode 100644
index 0000000..77ec0c8
--- /dev/null
+++ b/frontend/src/features/ontology/components/shared/SourceBadge.test.tsx
@@ -0,0 +1,49 @@
+import { describe, it, expect, vi } from 'vitest'
+import { render, screen, fireEvent } from '@testing-library/react'
+import { SourceBadge } from './SourceBadge'
+
+describe('SourceBadge', () => {
+  it('renders badge with abbreviated source name', () => {
+    render(<SourceBadge sourceId="abc-123" sourceName="SystemCore" />)
+    expect(screen.getByText('SYST')).toBeInTheDocument()
+  })
+
+  it('abbreviates sourceId when sourceName is not provided', () => {
+    render(<SourceBadge sourceId="abc-123" />)
+    expect(screen.getByText('ABC-')).toBeInTheDocument()
+  })
+
+  it('generates consistent color from sourceId hash', () => {
+    const { container } = render(<SourceBadge sourceId="abc-123" />)
+    const badge = container.querySelector('[style]')
+    expect(badge).not.toBeNull()
+    expect(badge!.getAttribute('style')).toMatch(/background-color/)
+  })
+
+  it('same sourceId always produces same color', () => {
+    const { container: c1 } = render(<SourceBadge sourceId="test-id" />)
+    const { container: c2 } = render(<SourceBadge sourceId="test-id" />)
+    const color1 = c1.querySelector('[style]')?.getAttribute('style')
+    const color2 = c2.querySelector('[style]')?.getAttribute('style')
+    expect(color1).toBe(color2)
+  })
+
+  it('renders nothing when sourceId is null', () => {
+    const { container } = render(<SourceBadge sourceId={null} />)
+    expect(container.innerHTML).toBe('')
+  })
+
+  it('renders nothing when sourceId is undefined', () => {
+    const { container } = render(<SourceBadge sourceId={undefined} />)
+    expect(container.innerHTML).toBe('')
+  })
+
+  it('clicking badge triggers source filter callback', () => {
+    const onSourceClick = vi.fn()
+    render(
+      <SourceBadge sourceId="abc-123" onSourceClick={onSourceClick} />,
+    )
+    fireEvent.click(screen.getByText('ABC-'))
+    expect(onSourceClick).toHaveBeenCalledWith('abc-123')
+  })
+})
diff --git a/frontend/src/features/ontology/components/shared/SourceBadge.tsx b/frontend/src/features/ontology/components/shared/SourceBadge.tsx
index 0f3cc7d..e8f9981 100644
--- a/frontend/src/features/ontology/components/shared/SourceBadge.tsx
+++ b/frontend/src/features/ontology/components/shared/SourceBadge.tsx
@@ -1,11 +1,35 @@
-interface SourceBadgeProps {
-  sourceId: string
+import { Badge } from '@/components/ui/badge'
+import { cn } from '@/lib/utils'
+
+export interface SourceBadgeProps {
+  sourceId: string | null | undefined
+  sourceName?: string
+  onSourceClick?: (sourceId: string) => void
+}
+
+function hashStringToHue(str: string): number {
+  let hash = 5381
+  for (let i = 0; i < str.length; i++) {
+    hash = (hash * 33) ^ str.charCodeAt(i)
+  }
+  return Math.abs(hash) % 360
 }
 
-export function SourceBadge({ sourceId }: SourceBadgeProps) {
+export function SourceBadge({ sourceId, sourceName, onSourceClick }: SourceBadgeProps) {
+  if (!sourceId) return null
+
+  const hue = hashStringToHue(sourceId)
+  const backgroundColor = `hsl(${hue}, 65%, 45%)`
+  const label = (sourceName ?? sourceId).slice(0, 4).toUpperCase()
+
   return (
-    <span className="ml-auto shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
-      {sourceId}
-    </span>
+    <Badge
+      variant="secondary"
+      className={cn('text-xs', onSourceClick && 'cursor-pointer')}
+      style={{ backgroundColor, color: 'white' }}
+      onClick={onSourceClick ? () => onSourceClick(sourceId) : undefined}
+    >
+      {label}
+    </Badge>
   )
 }
