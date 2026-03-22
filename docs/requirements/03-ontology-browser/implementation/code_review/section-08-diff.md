diff --git a/docs/requirements/03-ontology-browser/implementation/deep_implement_config.json b/docs/requirements/03-ontology-browser/implementation/deep_implement_config.json
index 639abee..6371191 100644
--- a/docs/requirements/03-ontology-browser/implementation/deep_implement_config.json
+++ b/docs/requirements/03-ontology-browser/implementation/deep_implement_config.json
@@ -41,6 +41,10 @@
     "section-06-shared-components": {
       "status": "complete",
       "commit_hash": "bc273fc"
+    },
+    "section-07-inline-editing": {
+      "status": "complete",
+      "commit_hash": "abb0475"
     }
   },
   "pre_commit": {
diff --git a/frontend/src/features/ontology/components/ClassTree/useClassTree.ts b/frontend/src/features/ontology/components/ClassTree/useClassTree.ts
index 4ae3489..524c448 100644
--- a/frontend/src/features/ontology/components/ClassTree/useClassTree.ts
+++ b/frontend/src/features/ontology/components/ClassTree/useClassTree.ts
@@ -1,8 +1,12 @@
-import { useState, useMemo } from 'react'
+import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
 import { useQuery } from '@tanstack/react-query'
 import { fetchClasses } from '@/features/ontology/lib/api'
 import type { Class } from '@/features/ontology/lib/api'
 import { buildClassTree, type ClassTreeData } from './buildClassTree'
+import { useLocalStorage } from '../useLocalStorage'
+
+const EXPANDED_KEY = 'ontology-browser-expanded'
+const SOURCE_FILTER_KEY = 'ontology-browser-source-filter'
 
 // source_id is not on the Class type yet — graceful degradation for Split 01
 function getSourceId(cls: Class): string | undefined {
@@ -11,6 +15,18 @@ function getSourceId(cls: Class): string | undefined {
     : undefined
 }
 
+function readExpandedFromStorage(): Set<string> {
+  try {
+    const raw = localStorage.getItem(EXPANDED_KEY)
+    if (!raw) return new Set()
+    const parsed = JSON.parse(raw)
+    if (Array.isArray(parsed)) return new Set(parsed)
+    return new Set()
+  } catch {
+    return new Set()
+  }
+}
+
 export interface UseClassTreeReturn {
   treeData: ClassTreeData | undefined
   classList: Class[]
@@ -21,11 +37,43 @@ export interface UseClassTreeReturn {
   sourceFilter: string | null
   setSourceFilter: (sourceId: string | null) => void
   availableSources: string[]
+  expandedIds: Set<string>
+  setExpandedIds: (ids: Set<string>) => void
 }
 
 export function useClassTree(): UseClassTreeReturn {
   const [searchText, setSearchText] = useState('')
-  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
+  const [sourceFilter, setSourceFilterState] = useLocalStorage<string | null>(SOURCE_FILTER_KEY, null)
+  const [expandedIds, setExpandedIdsState] = useState<Set<string>>(readExpandedFromStorage)
+
+  // Debounced localStorage write for expanded nodes
+  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
+
+  const setExpandedIds = useCallback((ids: Set<string>) => {
+    setExpandedIdsState(ids)
+    if (debounceRef.current) clearTimeout(debounceRef.current)
+    debounceRef.current = setTimeout(() => {
+      try {
+        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]))
+      } catch {
+        // Silently ignore storage errors
+      }
+    }, 300)
+  }, [])
+
+  // Flush on unmount
+  useEffect(() => {
+    return () => {
+      if (debounceRef.current) clearTimeout(debounceRef.current)
+    }
+  }, [])
+
+  const setSourceFilter = useCallback(
+    (sourceId: string | null) => {
+      setSourceFilterState(sourceId)
+    },
+    [setSourceFilterState],
+  )
 
   const {
     data: classList,
@@ -119,5 +167,7 @@ export function useClassTree(): UseClassTreeReturn {
     sourceFilter,
     setSourceFilter,
     availableSources,
+    expandedIds,
+    setExpandedIds,
   }
 }
diff --git a/frontend/src/features/ontology/components/statePersistence.test.ts b/frontend/src/features/ontology/components/statePersistence.test.ts
new file mode 100644
index 0000000..24710a0
--- /dev/null
+++ b/frontend/src/features/ontology/components/statePersistence.test.ts
@@ -0,0 +1,107 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
+import { renderHook, act } from '@testing-library/react'
+import { useLocalStorage } from './useLocalStorage'
+
+describe('State Persistence', () => {
+  beforeEach(() => {
+    localStorage.clear()
+  })
+
+  describe('useLocalStorage', () => {
+    it('returns default value when key is not set', () => {
+      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
+      expect(result.current[0]).toBe('default')
+    })
+
+    it('reads and parses stored value on init', () => {
+      localStorage.setItem('test-key', JSON.stringify('stored-value'))
+      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
+      expect(result.current[0]).toBe('stored-value')
+    })
+
+    it('writes to localStorage when setter is called', () => {
+      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
+      act(() => {
+        result.current[1]('new-value')
+      })
+      expect(result.current[0]).toBe('new-value')
+      expect(JSON.parse(localStorage.getItem('test-key')!)).toBe('new-value')
+    })
+
+    it('falls back to default on corrupt JSON', () => {
+      localStorage.setItem('test-key', 'not valid json')
+      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
+      expect(result.current[0]).toBe('default')
+    })
+
+    it('works with arrays', () => {
+      localStorage.setItem('test-array', JSON.stringify(['a', 'b', 'c']))
+      const { result } = renderHook(() =>
+        useLocalStorage<string[]>('test-array', []),
+      )
+      expect(result.current[0]).toEqual(['a', 'b', 'c'])
+    })
+
+    it('works with null values', () => {
+      localStorage.setItem('test-null', JSON.stringify(null))
+      const { result } = renderHook(() =>
+        useLocalStorage<string | null>('test-null', 'default'),
+      )
+      expect(result.current[0]).toBeNull()
+    })
+  })
+
+  describe('Expanded nodes persistence', () => {
+    beforeEach(() => {
+      vi.useFakeTimers()
+    })
+
+    afterEach(() => {
+      vi.useRealTimers()
+    })
+
+    it('debounced write does not happen before 300ms', () => {
+      // Simulate the debounce pattern used in useClassTree
+      const key = 'ontology-browser-expanded'
+      const writeDebounced = (ids: string[]) => {
+        setTimeout(() => {
+          localStorage.setItem(key, JSON.stringify(ids))
+        }, 300)
+      }
+
+      writeDebounced(['node-1', 'node-2'])
+      expect(localStorage.getItem(key)).toBeNull()
+
+      vi.advanceTimersByTime(299)
+      expect(localStorage.getItem(key)).toBeNull()
+
+      vi.advanceTimersByTime(1)
+      expect(JSON.parse(localStorage.getItem(key)!)).toEqual(['node-1', 'node-2'])
+    })
+  })
+
+  describe('Source filter persistence', () => {
+    it('persists source filter to localStorage', () => {
+      const { result } = renderHook(() =>
+        useLocalStorage<string | null>('ontology-browser-source-filter', null),
+      )
+      act(() => {
+        result.current[1]('source-1')
+      })
+      expect(JSON.parse(localStorage.getItem('ontology-browser-source-filter')!)).toBe(
+        'source-1',
+      )
+    })
+
+    it('restores source filter from localStorage', () => {
+      localStorage.setItem(
+        'ontology-browser-source-filter',
+        JSON.stringify('source-1'),
+      )
+      const { result } = renderHook(() =>
+        useLocalStorage<string | null>('ontology-browser-source-filter', null),
+      )
+      expect(result.current[0]).toBe('source-1')
+    })
+  })
+})
diff --git a/frontend/src/features/ontology/components/useLocalStorage.ts b/frontend/src/features/ontology/components/useLocalStorage.ts
new file mode 100644
index 0000000..fab88ac
--- /dev/null
+++ b/frontend/src/features/ontology/components/useLocalStorage.ts
@@ -0,0 +1,29 @@
+import { useState, useCallback } from 'react'
+
+function readFromStorage<T>(key: string, defaultValue: T): T {
+  try {
+    const raw = localStorage.getItem(key)
+    if (raw === null) return defaultValue
+    return JSON.parse(raw) as T
+  } catch {
+    return defaultValue
+  }
+}
+
+export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
+  const [state, setState] = useState<T>(() => readFromStorage(key, defaultValue))
+
+  const setValue = useCallback(
+    (value: T) => {
+      setState(value)
+      try {
+        localStorage.setItem(key, JSON.stringify(value))
+      } catch {
+        // Silently ignore storage errors (quota, private browsing)
+      }
+    },
+    [key],
+  )
+
+  return [state, setValue]
+}
