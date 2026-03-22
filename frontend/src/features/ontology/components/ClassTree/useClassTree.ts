import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchClasses } from '@/features/ontology/lib/api'
import type { Class } from '@/features/ontology/lib/api'
import { buildClassTree, type ClassTreeData } from './buildClassTree'

// source_id is not on the Class type yet — graceful degradation for Split 01
function getSourceId(cls: Class): string | undefined {
  return 'source_id' in cls
    ? (cls as Class & { source_id?: string }).source_id
    : undefined
}

export interface UseClassTreeReturn {
  treeData: ClassTreeData | undefined
  classList: Class[]
  isLoading: boolean
  error: Error | null
  searchText: string
  setSearchText: (text: string) => void
  sourceFilter: string | null
  setSourceFilter: (sourceId: string | null) => void
  availableSources: string[]
}

export function useClassTree(): UseClassTreeReturn {
  const [searchText, setSearchText] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const {
    data: classList,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['classes', 'list'],
    queryFn: fetchClasses,
    staleTime: 5 * 60 * 1000,
  })

  // Build full tree from class list
  const fullTree = useMemo(() => {
    if (!classList) return undefined
    return buildClassTree(classList)
  }, [classList])

  // Build class map for ancestor lookups
  const classMap = useMemo(() => {
    if (!classList) return new Map<string, Class>()
    const map = new Map<string, Class>()
    for (const cls of classList) {
      map.set(cls.id, cls)
    }
    return map
  }, [classList])

  // Extract available sources for the filter dropdown
  const availableSources = useMemo(() => {
    if (!classList) return []
    const sources = new Set<string>()
    for (const cls of classList) {
      const sourceId = getSourceId(cls)
      if (sourceId) sources.add(sourceId)
    }
    return [...sources].sort()
  }, [classList])

  // Apply filters
  const treeData = useMemo(() => {
    if (!fullTree || !classList) return fullTree
    if (!searchText && !sourceFilter) return fullTree

    // Find matching node IDs
    const matchingIds = new Set<string>()
    for (const cls of classList) {
      const matchesText = !searchText || cls.name.toLowerCase().includes(searchText.toLowerCase())
      const sourceId = getSourceId(cls)
      const matchesSource = !sourceFilter || sourceId === sourceFilter
      if (matchesText && matchesSource) {
        matchingIds.add(cls.id)
      }
    }

    // Collect ancestor paths for matching nodes
    const visibleIds = new Set<string>(matchingIds)
    for (const id of matchingIds) {
      let current = classMap.get(id)
      while (current?.parent_class_id && classMap.has(current.parent_class_id)) {
        visibleIds.add(current.parent_class_id)
        current = classMap.get(current.parent_class_id)
      }
    }

    // Rebuild filtered tree
    const filteredItems: Record<string, { children: string[]; data?: Class }> = {
      root: {
        children: fullTree.items.root.children.filter((id) => visibleIds.has(id)),
      },
    }
    for (const id of visibleIds) {
      const original = fullTree.items[id]
      if (original) {
        filteredItems[id] = {
          children: original.children.filter((childId) => visibleIds.has(childId)),
          data: original.data,
        }
      }
    }

    return { rootItem: 'root' as const, items: filteredItems }
  }, [fullTree, classList, classMap, searchText, sourceFilter])

  return {
    treeData,
    classList: classList ?? [],
    isLoading,
    error: error as Error | null,
    searchText,
    setSearchText,
    sourceFilter,
    setSourceFilter,
    availableSources,
  }
}
