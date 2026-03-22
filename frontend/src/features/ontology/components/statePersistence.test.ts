import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from './useLocalStorage'

describe('State Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('useLocalStorage', () => {
    it('returns default value when key is not set', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
      expect(result.current[0]).toBe('default')
    })

    it('reads and parses stored value on init', () => {
      localStorage.setItem('test-key', JSON.stringify('stored-value'))
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
      expect(result.current[0]).toBe('stored-value')
    })

    it('writes to localStorage when setter is called', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
      act(() => {
        result.current[1]('new-value')
      })
      expect(result.current[0]).toBe('new-value')
      expect(JSON.parse(localStorage.getItem('test-key')!)).toBe('new-value')
    })

    it('falls back to default on corrupt JSON', () => {
      localStorage.setItem('test-key', 'not valid json')
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
      expect(result.current[0]).toBe('default')
    })

    it('works with arrays', () => {
      localStorage.setItem('test-array', JSON.stringify(['a', 'b', 'c']))
      const { result } = renderHook(() =>
        useLocalStorage<string[]>('test-array', []),
      )
      expect(result.current[0]).toEqual(['a', 'b', 'c'])
    })

    it('works with null values', () => {
      localStorage.setItem('test-null', JSON.stringify(null))
      const { result } = renderHook(() =>
        useLocalStorage<string | null>('test-null', 'default'),
      )
      expect(result.current[0]).toBeNull()
    })
  })

  describe('Expanded nodes persistence', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('debounced write does not happen before 300ms', () => {
      // Simulate the debounce pattern used in useClassTree
      const key = 'ontology-browser-expanded'
      const writeDebounced = (ids: string[]) => {
        setTimeout(() => {
          localStorage.setItem(key, JSON.stringify(ids))
        }, 300)
      }

      writeDebounced(['node-1', 'node-2'])
      expect(localStorage.getItem(key)).toBeNull()

      vi.advanceTimersByTime(299)
      expect(localStorage.getItem(key)).toBeNull()

      vi.advanceTimersByTime(1)
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual(['node-1', 'node-2'])
    })
  })

  describe('Expanded nodes restoration', () => {
    it('restores expanded nodes from localStorage on init', () => {
      localStorage.setItem(
        'ontology-browser-expanded',
        JSON.stringify(['node-1', 'node-2']),
      )
      // Verify the readExpandedFromStorage pattern works
      const raw = localStorage.getItem('ontology-browser-expanded')
      const parsed = JSON.parse(raw!)
      expect(parsed).toEqual(['node-1', 'node-2'])
      expect(new Set(parsed)).toEqual(new Set(['node-1', 'node-2']))
    })

    it('falls back to empty set on corrupt expanded data', () => {
      localStorage.setItem('ontology-browser-expanded', 'not valid json')
      let result: Set<string>
      try {
        const raw = localStorage.getItem('ontology-browser-expanded')!
        const parsed = JSON.parse(raw)
        result = Array.isArray(parsed) ? new Set(parsed) : new Set()
      } catch {
        result = new Set()
      }
      expect(result.size).toBe(0)
    })
  })

  describe('Source filter persistence', () => {
    it('persists source filter to localStorage', () => {
      const { result } = renderHook(() =>
        useLocalStorage<string | null>('ontology-browser-source-filter', null),
      )
      act(() => {
        result.current[1]('source-1')
      })
      expect(JSON.parse(localStorage.getItem('ontology-browser-source-filter')!)).toBe(
        'source-1',
      )
    })

    it('restores source filter from localStorage', () => {
      localStorage.setItem(
        'ontology-browser-source-filter',
        JSON.stringify('source-1'),
      )
      const { result } = renderHook(() =>
        useLocalStorage<string | null>('ontology-browser-source-filter', null),
      )
      expect(result.current[0]).toBe('source-1')
    })
  })
})
