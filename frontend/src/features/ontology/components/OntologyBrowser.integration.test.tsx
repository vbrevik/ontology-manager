import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Class, Property, OntologyVersion } from '@/features/ontology/lib/api'

// --- Mock data ---

const mockClasses: Class[] = [
  {
    id: 'cls-1',
    name: 'Vehicle',
    description: 'A mode of transport',
    parent_class_id: undefined,
    version_id: 'v1',
    is_abstract: false,
    attributes: {},
    created_at: '2026-01-01',
  },
  {
    id: 'cls-2',
    name: 'Car',
    description: 'A four-wheeled vehicle',
    parent_class_id: 'cls-1',
    version_id: 'v1',
    is_abstract: false,
    attributes: {},
    created_at: '2026-01-01',
  },
  {
    id: 'cls-3',
    name: 'Truck',
    description: 'A heavy-duty vehicle',
    parent_class_id: 'cls-1',
    version_id: 'v1',
    is_abstract: false,
    attributes: {},
    created_at: '2026-01-01',
  },
]

const mockProperties: Record<string, Property[]> = {
  'cls-1': [
    {
      id: 'p1',
      name: 'speed',
      class_id: 'cls-1',
      data_type: 'integer',
      is_required: true,
      is_unique: false,
      version_id: 'v1',
      validation_rules: null,
    },
  ],
  'cls-2': [
    {
      id: 'p2',
      name: 'doors',
      class_id: 'cls-2',
      data_type: 'integer',
      is_required: false,
      is_unique: false,
      version_id: 'v1',
      validation_rules: null,
    },
  ],
}

const mockVersion: OntologyVersion = {
  id: 'v1',
  version: '1.0',
  is_current: true,
  created_at: '2026-01-01',
}

// --- Mocks ---

vi.mock('@/features/ontology/lib/api', () => ({
  fetchClasses: vi.fn(() => Promise.resolve(mockClasses)),
  getClass: vi.fn((id: string) => {
    const cls = mockClasses.find((c) => c.id === id)
    return cls ? Promise.resolve(cls) : Promise.reject(new Error('Not found'))
  }),
  fetchProperties: vi.fn((classId: string) =>
    Promise.resolve(mockProperties[classId] ?? []),
  ),
  fetchCurrentVersion: vi.fn(() => Promise.resolve(mockVersion)),
  updateClass: vi.fn(),
  createClass: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// Mock resizable panels (jsdom doesn't support ResizeObserver)
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel-group">{children}</div>
  ),
  ResizablePanel: ({
    children,
    'data-testid': testId,
  }: {
    children: React.ReactNode
    'data-testid'?: string
    [key: string]: unknown
  }) => <div data-testid={testId}>{children}</div>,
  ResizableHandle: () => <div data-testid="resize-handle" />,
}))

// Mock ClassTree: we import the real context but replace the tree rendering.
// The mock ClassTree renders simple buttons that wire to setSelectedClassId.
const { useOntologyBrowser: useCtx } = await vi.importActual<typeof import('./OntologyBrowserContext')>('./OntologyBrowserContext')

vi.mock('./ClassTree/ClassTree', () => {
  const classes = [
    { id: 'cls-1', name: 'Vehicle' },
    { id: 'cls-2', name: 'Car' },
    { id: 'cls-3', name: 'Truck' },
  ]
  return {
    ClassTree: () => {
      const { setSelectedClassId } = useCtx()
      return (
        <div data-testid="class-tree">
          {classes.map((cls) => (
            <button
              key={cls.id}
              data-testid={`tree-node-${cls.id}`}
              onClick={() => setSelectedClassId(cls.id)}
            >
              {cls.name}
            </button>
          ))}
        </div>
      )
    },
  }
})

// Mock shared components used by ClassDetail
vi.mock('./shared/SourceBadge', () => ({
  SourceBadge: () => null,
}))
vi.mock('./shared/ClassLink', () => ({
  ClassLink: ({
    label,
    onNavigate,
    classId,
  }: {
    label: string
    classId: string
    onNavigate?: (id: string) => void
  }) => (
    <button data-testid="class-link" onClick={() => onNavigate?.(classId)}>
      {label}
    </button>
  ),
}))
vi.mock('./shared/ConflictBadge', () => ({
  ConflictBadge: () => null,
}))

import { OntologyBrowser } from './OntologyBrowser'

function renderBrowser() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <OntologyBrowser />
    </QueryClientProvider>,
  )
}

describe('OntologyBrowser Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows placeholder when nothing is selected', async () => {
    renderBrowser()
    await waitFor(() => {
      expect(screen.getByText(/select a class/i)).toBeInTheDocument()
    })
  })

  it('renders tree nodes from class list', async () => {
    renderBrowser()
    await waitFor(() => {
      expect(screen.getByText('Vehicle')).toBeInTheDocument()
      expect(screen.getByText('Car')).toBeInTheDocument()
      expect(screen.getByText('Truck')).toBeInTheDocument()
    })
  })

  it('tree selection updates detail panel', async () => {
    const user = userEvent.setup()
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('Vehicle')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('tree-node-cls-1'))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vehicle' })).toBeInTheDocument()
    })

    // Properties should show
    await waitFor(() => {
      expect(screen.getByText('speed')).toBeInTheDocument()
    })
  })

  it('switching selection updates detail panel', async () => {
    const user = userEvent.setup()
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('Vehicle')).toBeInTheDocument()
    })

    // Select Vehicle
    await user.click(screen.getByTestId('tree-node-cls-1'))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vehicle' })).toBeInTheDocument()
      expect(screen.getByText('speed')).toBeInTheDocument()
    })

    // Switch to Car
    await user.click(screen.getByTestId('tree-node-cls-2'))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Car' })).toBeInTheDocument()
      expect(screen.getByText('doors')).toBeInTheDocument()
    })
  })

  it('ClassLink navigation updates selection', async () => {
    const user = userEvent.setup()
    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText('Car')).toBeInTheDocument()
    })

    // Select Car (child of Vehicle)
    await user.click(screen.getByTestId('tree-node-cls-2'))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Car' })).toBeInTheDocument()
    })

    // Click the parent ClassLink
    const classLink = await screen.findByTestId('class-link')
    await user.click(classLink)

    // Should navigate to Vehicle
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vehicle' })).toBeInTheDocument()
    })
  })

  it('stale selection is cleared on mount', async () => {
    localStorage.setItem(
      'ontology-browser-selected',
      JSON.stringify('nonexistent-id'),
    )

    renderBrowser()

    await waitFor(() => {
      expect(screen.getByText(/select a class/i)).toBeInTheDocument()
    })
  })
})
