import { Component, useRef, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { OntologyBrowserProvider } from './OntologyBrowserContext'
import { useClassTree } from './ClassTree/useClassTree'
import { ClassTree } from './ClassTree/ClassTree'
import { ClassDetail } from './ClassDetail/ClassDetail'

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class PanelErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch() {
    // Error logging can be added here
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
            <p>Something went wrong</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </Button>
          </div>
        )
      )
    }
    return this.props.children
  }
}

// --- Main Layout ---

export function OntologyBrowser() {
  const { classList } = useClassTree()
  const treePanelRef = useRef<PanelImperativeHandle>(null)

  const handleCollapseToggle = () => {
    const panel = treePanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }

  return (
    <OntologyBrowserProvider classList={classList}>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel
          panelRef={treePanelRef}
          id="tree"
          defaultSize={30}
          minSize={15}
          maxSize={50}
          collapsible
          collapsedSize={0}
          data-testid="tree-panel"
          className="relative"
        >
          <PanelErrorBoundary>
            <ClassTree />
          </PanelErrorBoundary>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 z-20 h-6 w-6 -translate-y-1/2 translate-x-1/2 rounded-full"
            onClick={handleCollapseToggle}
            aria-label="Toggle tree panel"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel id="detail" defaultSize={70} data-testid="detail-panel">
          <PanelErrorBoundary>
            <ClassDetail />
          </PanelErrorBoundary>
        </ResizablePanel>
      </ResizablePanelGroup>
    </OntologyBrowserProvider>
  )
}
