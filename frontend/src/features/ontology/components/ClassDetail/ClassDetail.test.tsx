import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let mockSelectedClassId: string | null = null
let mockIsLoading = false
let mockClassData: any = null
let mockProperties: any[] = []

vi.mock('../OntologyBrowserContext', () => ({
  useOntologyBrowser: () => ({
    selectedClassId: mockSelectedClassId,
    setSelectedClassId: vi.fn(),
    labelMode: 'name' as const,
    toggleLabelMode: vi.fn(),
  }),
}))

vi.mock('../ClassTree/useClassTree', () => ({
  useClassTree: () => ({
    classList: [
      { id: 'cls-parent', name: 'ParentClass' },
      { id: 'cls-1', name: 'Vehicle' },
    ],
    treeData: undefined,
    isLoading: false,
    error: null,
    searchText: '',
    setSearchText: vi.fn(),
    sourceFilter: null,
    setSourceFilter: vi.fn(),
    availableSources: [],
  }),
}))

vi.mock('./useClassDetail', () => ({
  useClassDetail: () => ({
    classData: mockClassData,
    properties: mockProperties,
    currentVersion: { id: 'v1' },
    isLoading: mockIsLoading,
    isPlaceholderData: false,
    error: null,
    updateDescription: vi.fn(),
    createProperty: vi.fn(),
    updateProperty: vi.fn(),
    deleteProperty: vi.fn(),
  }),
}))

// Mock shared components
vi.mock('../shared/SourceBadge', () => ({
  SourceBadge: ({ sourceId }: { sourceId: string }) => (
    <span data-testid="source-badge">{sourceId}</span>
  ),
}))
vi.mock('../shared/ClassLink', () => ({
  ClassLink: ({ label }: { label: string }) => (
    <span data-testid="class-link">{label}</span>
  ),
}))

import { ClassDetail } from './ClassDetail'

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ClassDetail />
    </QueryClientProvider>,
  )
}

describe('ClassDetail', () => {
  beforeEach(() => {
    mockSelectedClassId = null
    mockIsLoading = false
    mockClassData = null
    mockProperties = []
  })

  it('shows "Select a class" placeholder when no class selected', () => {
    renderWithProviders()
    expect(screen.getByText(/select a class/i)).toBeInTheDocument()
  })

  it('renders ClassHeader and ClassProperties when class selected', () => {
    mockSelectedClassId = 'cls-1'
    mockClassData = {
      id: 'cls-1',
      name: 'Vehicle',
      description: 'A vehicle',
      parent_class_id: 'cls-parent',
      version_id: 'v1',
      is_abstract: false,
      attributes: {},
      created_at: '2026-01-01',
    }
    mockProperties = [
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
    ]

    renderWithProviders()
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
    expect(screen.getByText('speed')).toBeInTheDocument()
  })

  it('renders ClassConflicts only when conflict data present', () => {
    mockSelectedClassId = 'cls-1'
    mockClassData = {
      id: 'cls-1',
      name: 'Vehicle',
      version_id: 'v1',
      is_abstract: false,
      attributes: {},
      created_at: '2026-01-01',
      conflictData: {
        baseDefinition: { name: 'Vehicle' },
        extensionDefinition: { name: 'Vehicle2' },
        resolutionStatus: 'unresolved',
      },
    }

    renderWithProviders()
    expect(screen.getByText('Conflicts')).toBeInTheDocument()
  })

  it('does not render ClassConflicts when no conflict data', () => {
    mockSelectedClassId = 'cls-1'
    mockClassData = {
      id: 'cls-1',
      name: 'Vehicle',
      version_id: 'v1',
      is_abstract: false,
      attributes: {},
      created_at: '2026-01-01',
    }

    renderWithProviders()
    expect(screen.queryByText('Conflicts')).not.toBeInTheDocument()
  })

  it('shows loading skeleton while data is loading', () => {
    mockSelectedClassId = 'cls-1'
    mockIsLoading = true

    renderWithProviders()
    expect(screen.getByTestId('detail-skeleton')).toBeInTheDocument()
  })
})
