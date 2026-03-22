import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Flags to control mock behavior
let classTreeShouldThrow = false
let classDetailShouldThrow = false

// Mock the data layer hook
vi.mock('./ClassTree/useClassTree', () => ({
  useClassTree: () => ({
    treeData: undefined,
    classList: [],
    isLoading: false,
    error: null,
    searchText: '',
    setSearchText: vi.fn(),
    sourceFilter: null,
    setSourceFilter: vi.fn(),
    availableSources: [],
  }),
}))

// Mock resizable panels — they require ResizeObserver not available in jsdom
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: any) => (
    <div data-testid="panel-group">{children}</div>
  ),
  ResizablePanel: ({
    children,
    'data-testid': testId,
  }: any) => <div data-testid={testId}>{children}</div>,
  ResizableHandle: ({ children }: any) => (
    <div data-testid="resize-handle">{children}</div>
  ),
}))

// Mock ClassTree — conditionally throws for error boundary testing
vi.mock('./ClassTree/ClassTree', () => ({
  ClassTree: () => {
    if (classTreeShouldThrow) throw new Error('ClassTree crash')
    return <div data-testid="class-tree">ClassTree mock</div>
  },
}))

// Mock ClassDetail — conditionally throws for error boundary testing
vi.mock('./ClassDetail/ClassDetail', () => ({
  ClassDetail: () => {
    if (classDetailShouldThrow) throw new Error('ClassDetail crash')
    return <div data-testid="class-detail">ClassDetail mock</div>
  },
}))

import { OntologyBrowser } from './OntologyBrowser'

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <OntologyBrowser />
    </QueryClientProvider>,
  )
}

describe('OntologyBrowser', () => {
  beforeEach(() => {
    localStorage.clear()
    classTreeShouldThrow = false
    classDetailShouldThrow = false
  })

  it('renders PanelGroup with two panels', () => {
    renderWithProviders()

    expect(screen.getByTestId('tree-panel')).toBeInTheDocument()
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument()
  })

  it('left panel contains ClassTree', () => {
    renderWithProviders()

    const treePanel = screen.getByTestId('tree-panel')
    expect(treePanel).toContainElement(screen.getByTestId('class-tree'))
  })

  it('right panel contains ClassDetail', () => {
    renderWithProviders()

    const detailPanel = screen.getByTestId('detail-panel')
    expect(detailPanel).toContainElement(screen.getByTestId('class-detail'))
  })

  it('wraps children in OntologyBrowserContext provider', () => {
    renderWithProviders()

    expect(screen.getByTestId('class-tree')).toBeInTheDocument()
    expect(screen.getByTestId('class-detail')).toBeInTheDocument()
  })

  it('error boundary in tree panel catches errors without crashing detail panel', () => {
    classTreeShouldThrow = true
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithProviders()

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByTestId('class-detail')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('error boundary in detail panel catches errors without crashing tree panel', () => {
    classDetailShouldThrow = true
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithProviders()

    expect(screen.getByTestId('class-tree')).toBeInTheDocument()
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

    consoleSpy.mockRestore()
  })
})
