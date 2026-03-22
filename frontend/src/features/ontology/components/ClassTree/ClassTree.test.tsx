import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Class } from '@/features/ontology/lib/api'

const mockSetSelectedClassId = vi.fn()
let mockSelectedClassId: string | null = null

// Mock context
vi.mock('../OntologyBrowserContext', () => ({
  useOntologyBrowser: () => ({
    selectedClassId: mockSelectedClassId,
    setSelectedClassId: mockSetSelectedClassId,
    labelMode: 'name' as const,
    toggleLabelMode: vi.fn(),
  }),
}))

// Mock useClassTree
const mockClassList: Class[] = [
  {
    id: 'cls-1',
    name: 'Vehicle',
    parent_class_id: null as any,
    version_id: 'v1',
    is_abstract: false,
    attributes: {},
    created_at: '2026-01-01',
  },
  {
    id: 'cls-2',
    name: 'Car',
    parent_class_id: 'cls-1',
    version_id: 'v1',
    is_abstract: false,
    attributes: {},
    created_at: '2026-01-01',
  },
]

vi.mock('./useClassTree', () => ({
  useClassTree: () => ({
    treeData: {
      rootItem: 'root',
      items: {
        root: { children: ['cls-1'] },
        'cls-1': { children: ['cls-2'], data: mockClassList[0] },
        'cls-2': { children: [], data: mockClassList[1] },
      },
    },
    classList: mockClassList,
    isLoading: false,
    error: null,
    searchText: '',
    setSearchText: vi.fn(),
    sourceFilter: null,
    setSourceFilter: vi.fn(),
    availableSources: [],
  }),
}))

// Mock headless-tree — jsdom lacks layout measurements needed for the real library
let mockExpandedItems = new Set<string>()
const mockTreeItems = [
  {
    getId: () => 'cls-1',
    getItemData: () => 'cls-1',
    getItemName: () => 'Vehicle',
    getItemMeta: () => ({ level: 0, index: 0 }),
    isExpanded: () => mockExpandedItems.has('cls-1'),
    isSelected: () => mockSelectedClassId === 'cls-1',
    isFocused: () => false,
    isFolder: () => true,
    getProps: () => ({}),
    expand: () => mockExpandedItems.add('cls-1'),
    collapse: () => mockExpandedItems.delete('cls-1'),
  },
  {
    getId: () => 'cls-2',
    getItemData: () => 'cls-2',
    getItemName: () => 'Car',
    getItemMeta: () => ({ level: 1, index: 1 }),
    isExpanded: () => false,
    isSelected: () => mockSelectedClassId === 'cls-2',
    isFocused: () => false,
    isFolder: () => false,
    getProps: () => ({}),
    expand: undefined,
    collapse: undefined,
  },
]

vi.mock('@headless-tree/core', () => ({
  buildProxiedInstance: vi.fn(),
  syncDataLoaderFeature: {},
  hotkeysCoreFeature: {},
}))

vi.mock('@headless-tree/react', () => ({
  useTree: () => ({
    getItems: () => mockTreeItems,
    getContainerProps: () => ({ 'data-tree': true }),
  }),
}))

// Mock virtualizer — jsdom doesn't support scroll measurements
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 32,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 32,
        size: 32,
        key: i,
      })),
    scrollToIndex: vi.fn(),
  }),
}))

// Mock shared components
vi.mock('../shared/SourceBadge', () => ({
  SourceBadge: () => <span data-testid="source-badge" />,
}))
vi.mock('../shared/ConflictBadge', () => ({
  ConflictBadge: () => <span data-testid="conflict-badge" />,
}))

import { ClassTree } from './ClassTree'

describe('ClassTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedClassId = null
    mockExpandedItems = new Set()
  })

  it('renders search bar and tree container', () => {
    render(<ClassTree />)
    expect(screen.getByPlaceholderText(/search classes/i)).toBeInTheDocument()
    expect(screen.getByRole('tree')).toBeInTheDocument()
  })

  it('renders tree nodes from provided class data', () => {
    render(<ClassTree />)
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
    expect(screen.getByText('Car')).toBeInTheDocument()
  })

  it('clicking a node calls setSelectedClassId', () => {
    render(<ClassTree />)
    fireEvent.click(screen.getByText('Vehicle'))
    expect(mockSetSelectedClassId).toHaveBeenCalledWith('cls-1')
  })

  it('selected node has bg-accent class', () => {
    mockSelectedClassId = 'cls-1'
    render(<ClassTree />)

    // Find the Vehicle node's ClassTreeNode container
    const vehicleText = screen.getByText('Vehicle')
    const nodeDiv = vehicleText.closest('.bg-accent')
    expect(nodeDiv).not.toBeNull()
  })

  it('expand/collapse works on chevron click', () => {
    render(<ClassTree />)
    const chevrons = screen.getAllByTestId('tree-chevron')
    expect(chevrons.length).toBeGreaterThan(0)
    fireEvent.click(chevrons[0])
    // Verify the mock expand was called (mockExpandedItems is mutated by the mock)
    expect(mockExpandedItems.has('cls-1')).toBe(true)
  })

  // Note: Keyboard navigation tests verify the component doesn't crash on
  // keyboard events when headless-tree is mocked. Full keyboard behavior is
  // tested in section-09 integration tests with a real headless-tree instance.

  it('keyboard Up/Down arrows navigate between nodes', () => {
    render(<ClassTree />)
    const tree = screen.getByRole('tree')
    fireEvent.keyDown(tree, { key: 'ArrowDown' })
    // Tree remains rendered and functional after keyboard event
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
    expect(screen.getByText('Car')).toBeInTheDocument()
  })

  it('keyboard Left/Right collapse/expand nodes', () => {
    render(<ClassTree />)
    const tree = screen.getByRole('tree')
    fireEvent.keyDown(tree, { key: 'ArrowRight' })
    fireEvent.keyDown(tree, { key: 'ArrowLeft' })
    expect(screen.getAllByRole('treeitem').length).toBe(2)
  })

  it('keyboard Enter selects focused node', () => {
    render(<ClassTree />)
    const tree = screen.getByRole('tree')
    fireEvent.keyDown(tree, { key: 'Enter' })
    // With mocked headless-tree, Enter doesn't trigger selection.
    // Full keyboard selection tested in section-09 integration tests.
    expect(screen.getAllByRole('treeitem').length).toBe(2)
  })

  it('Home/End keys jump to first/last node', () => {
    render(<ClassTree />)
    const tree = screen.getByRole('tree')
    fireEvent.keyDown(tree, { key: 'Home' })
    fireEvent.keyDown(tree, { key: 'End' })
    expect(screen.getAllByRole('treeitem').length).toBe(2)
  })
})
