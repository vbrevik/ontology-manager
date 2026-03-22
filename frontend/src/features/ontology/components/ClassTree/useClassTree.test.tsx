import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Class } from '@/features/ontology/lib/api'

vi.mock('@/features/ontology/lib/api', () => ({
  fetchClasses: vi.fn(),
}))

import { fetchClasses } from '@/features/ontology/lib/api'
import { useClassTree } from './useClassTree'

const mockedFetchClasses = vi.mocked(fetchClasses)

function makeClass(overrides: {
  id: string
  name: string
  parent_class_id?: string | null
  source_id?: string
}): Class {
  return {
    id: overrides.id,
    name: overrides.name,
    parent_class_id: overrides.parent_class_id ?? null,
    description: '',
    version_id: 'v1',
    is_abstract: false,
    attributes: {},
    created_at: '2024-01-01T00:00:00Z',
    ...(overrides.source_id ? { source_id: overrides.source_id } : {}),
  } as Class
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useClassTree', () => {
  it('returns empty tree structure when class list is empty', async () => {
    mockedFetchClasses.mockResolvedValue([])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.treeData?.items.root.children).toEqual([])
  })

  it('builds correct parent-child hierarchy from flat class list', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Parent' }),
      makeClass({ id: '2', name: 'Child', parent_class_id: '1' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.treeData?.items.root.children).toEqual(['1'])
    expect(result.current.treeData?.items['1'].children).toEqual(['2'])
  })

  it('root nodes are those with parent_class_id === null', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Root', parent_class_id: null }),
      makeClass({ id: '2', name: 'Child', parent_class_id: '1' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.treeData?.items.root.children).toEqual(['1'])
  })

  it('orphaned nodes become root nodes', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Orphan', parent_class_id: 'nonexistent' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.treeData?.items.root.children).toEqual(['1'])
  })

  it('children are sorted alphabetically by name at each level', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Root' }),
      makeClass({ id: '2', name: 'Zebra', parent_class_id: '1' }),
      makeClass({ id: '3', name: 'Apple', parent_class_id: '1' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.treeData?.items['1'].children).toEqual(['3', '2'])
  })

  it('converts to headless-tree format', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Root' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.treeData?.rootItem).toBe('root')
    expect(result.current.treeData?.items).toHaveProperty('root')
    expect(result.current.treeData?.items).toHaveProperty('1')
  })

  it('text filter returns only matching nodes plus ancestors', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Vehicle' }),
      makeClass({ id: '2', name: 'Car', parent_class_id: '1' }),
      makeClass({ id: '3', name: 'Truck', parent_class_id: '1' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setSearchText('car'))

    expect(result.current.treeData?.items.root.children).toEqual(['1'])
    expect(result.current.treeData?.items['1'].children).toEqual(['2'])
    // Truck should not be in filtered tree
    expect(result.current.treeData?.items['3']).toBeUndefined()
  })

  it('text filter is case-insensitive', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Vehicle' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setSearchText('VEHICLE'))
    expect(result.current.treeData?.items.root.children).toEqual(['1'])
  })

  it('source filter returns only matching classes plus ancestors', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Root' }),
      makeClass({ id: '2', name: 'FromA', parent_class_id: '1', source_id: 'src-a' }),
      makeClass({ id: '3', name: 'FromB', parent_class_id: '1', source_id: 'src-b' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setSourceFilter('src-a'))

    // Root (ancestor) and FromA should be visible
    expect(result.current.treeData?.items.root.children).toEqual(['1'])
    expect(result.current.treeData?.items['1'].children).toEqual(['2'])
    expect(result.current.treeData?.items['3']).toBeUndefined()
  })

  it('source filter is no-op when no classes have source_id', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Root' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setSourceFilter('nonexistent'))

    // No classes match, so root has no children
    expect(result.current.treeData?.items.root.children).toEqual([])
  })

  it('combined text + source filter applies both conditions', async () => {
    mockedFetchClasses.mockResolvedValue([
      makeClass({ id: '1', name: 'Root' }),
      makeClass({ id: '2', name: 'Car', parent_class_id: '1', source_id: 'src-a' }),
      makeClass({ id: '3', name: 'Carpet', parent_class_id: '1', source_id: 'src-b' }),
    ])
    const { result } = renderHook(() => useClassTree(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setSearchText('car')
      result.current.setSourceFilter('src-a')
    })

    // Only Car (matches both) + Root (ancestor) should be visible
    expect(result.current.treeData?.items['1'].children).toEqual(['2'])
    expect(result.current.treeData?.items['3']).toBeUndefined()
  })
})
