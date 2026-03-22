import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  OntologyBrowserProvider,
  useOntologyBrowser,
} from './OntologyBrowserContext'

function createWrapper(classList?: Array<{ id: string }>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <OntologyBrowserProvider classList={classList}>
        {children}
      </OntologyBrowserProvider>
    )
  }
}

describe('OntologyBrowserContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes selectedClassId from localStorage if present', () => {
    localStorage.setItem('ontology-browser-selected', JSON.stringify('some-id'))

    const { result } = renderHook(() => useOntologyBrowser(), {
      wrapper: createWrapper([{ id: 'some-id' }]),
    })

    expect(result.current.selectedClassId).toBe('some-id')
  })

  it('defaults selectedClassId to null if localStorage empty', () => {
    const { result } = renderHook(() => useOntologyBrowser(), {
      wrapper: createWrapper(),
    })

    expect(result.current.selectedClassId).toBeNull()
  })

  it('persists selectedClassId to localStorage on change', () => {
    const { result } = renderHook(() => useOntologyBrowser(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setSelectedClassId('new-id')
    })

    expect(localStorage.getItem('ontology-browser-selected')).toBe(
      JSON.stringify('new-id'),
    )
  })

  it('clears selectedClassId to null when class not found in class list (stale recovery)', () => {
    localStorage.setItem(
      'ontology-browser-selected',
      JSON.stringify('deleted-class'),
    )

    const { result } = renderHook(() => useOntologyBrowser(), {
      wrapper: createWrapper([{ id: 'class-a' }, { id: 'class-b' }]),
    })

    expect(result.current.selectedClassId).toBeNull()
  })

  it('provides labelMode and toggleLabelMode', () => {
    const { result } = renderHook(() => useOntologyBrowser(), {
      wrapper: createWrapper(),
    })

    expect(result.current.labelMode).toBe('name')

    act(() => {
      result.current.toggleLabelMode()
    })
    expect(result.current.labelMode).toBe('description')

    act(() => {
      result.current.toggleLabelMode()
    })
    expect(result.current.labelMode).toBe('name')
  })
})
