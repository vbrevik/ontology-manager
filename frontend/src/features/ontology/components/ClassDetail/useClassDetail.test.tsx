import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/features/ontology/lib/api', () => ({
  getClass: vi.fn(),
  fetchProperties: vi.fn(),
  fetchCurrentVersion: vi.fn(),
  updateClass: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
}))

import {
  getClass,
  fetchProperties,
  fetchCurrentVersion,
} from '@/features/ontology/lib/api'
import { useClassDetail } from './useClassDetail'

const mockedGetClass = vi.mocked(getClass)
const mockedFetchProperties = vi.mocked(fetchProperties)
const mockedFetchCurrentVersion = vi.mocked(fetchCurrentVersion)

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
  mockedFetchCurrentVersion.mockResolvedValue({
    id: 'ver-1',
    version: '1.0',
    is_current: true,
    created_at: '2024-01-01T00:00:00Z',
  })
})

describe('useClassDetail', () => {
  it('fetches class detail, properties, and current version when classId provided', async () => {
    mockedGetClass.mockResolvedValue({
      id: 'cls-1',
      name: 'Vehicle',
      description: 'A vehicle',
      version_id: 'v1',
      is_abstract: false,
      attributes: {},
      created_at: '2024-01-01T00:00:00Z',
    })
    mockedFetchProperties.mockResolvedValue([
      {
        id: 'prop-1',
        name: 'speed',
        class_id: 'cls-1',
        data_type: 'integer',
        is_required: false,
        is_unique: false,
        version_id: 'v1',
        validation_rules: null,
      },
    ])

    const { result } = renderHook(() => useClassDetail('cls-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.classData?.name).toBe('Vehicle')
    expect(result.current.properties).toHaveLength(1)
    expect(result.current.currentVersion?.id).toBe('ver-1')
    expect(mockedGetClass).toHaveBeenCalledWith('cls-1')
    expect(mockedFetchProperties).toHaveBeenCalledWith('cls-1')
  })

  it('does not fetch when classId is null (queries disabled)', async () => {
    const { result } = renderHook(() => useClassDetail(null), {
      wrapper: createWrapper(),
    })

    // Give time for any async operations
    await new Promise((r) => setTimeout(r, 50))

    expect(mockedGetClass).not.toHaveBeenCalled()
    expect(mockedFetchProperties).not.toHaveBeenCalled()
    expect(result.current.classData).toBeUndefined()
    expect(result.current.properties).toBeUndefined()
  })

  it('provides mutation function for description update', async () => {
    mockedGetClass.mockResolvedValue({
      id: 'cls-1',
      name: 'Vehicle',
      version_id: 'v1',
      is_abstract: false,
      attributes: {},
      created_at: '2024-01-01T00:00:00Z',
    })
    mockedFetchProperties.mockResolvedValue([])

    const { result } = renderHook(() => useClassDetail('cls-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.updateDescription).toBe('function')
  })

  it('provides mutation functions for property CRUD', async () => {
    mockedGetClass.mockResolvedValue({
      id: 'cls-1',
      name: 'Vehicle',
      version_id: 'v1',
      is_abstract: false,
      attributes: {},
      created_at: '2024-01-01T00:00:00Z',
    })
    mockedFetchProperties.mockResolvedValue([])

    const { result } = renderHook(() => useClassDetail('cls-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.createProperty).toBe('function')
    expect(typeof result.current.updateProperty).toBe('function')
    expect(typeof result.current.deleteProperty).toBe('function')
  })

  it('handles API errors gracefully (returns error state)', async () => {
    mockedGetClass.mockRejectedValue(new Error('Network error'))
    mockedFetchProperties.mockResolvedValue([])

    const { result } = renderHook(() => useClassDetail('cls-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.error?.message).toBe('Network error')
  })
})
