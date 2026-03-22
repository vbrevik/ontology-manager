import { useRef, useState } from 'react'
import {
  buildProxiedInstance,
  syncDataLoaderFeature,
  hotkeysCoreFeature,
  type TreeState,
} from '@headless-tree/core'
import { useTree } from '@headless-tree/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Class } from '@/features/ontology/lib/api'
import { useOntologyBrowser } from '../OntologyBrowserContext'
import { useClassTree } from './useClassTree'
import { ClassTreeSearch } from './ClassTreeSearch'
import { ClassTreeNode, type ClassNodeData } from './ClassTreeNode'

function classToNodeData(cls: Class): ClassNodeData {
  return {
    id: cls.id,
    name: cls.name,
    description: cls.description,
    parent_class_id: cls.parent_class_id ?? undefined,
    source_id: 'source_id' in cls ? (cls as any).source_id : undefined,
    hasConflict: false,
  }
}

export function ClassTree() {
  const {
    treeData,
    isLoading,
    error,
    searchText,
    setSearchText,
    sourceFilter,
    setSourceFilter,
    availableSources,
  } = useClassTree()

  const { selectedClassId, setSelectedClassId, labelMode } =
    useOntologyBrowser()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<Partial<TreeState<string>>>({})

  const tree = useTree<string>({
    instanceBuilder: buildProxiedInstance,
    state,
    setState,
    rootItemId: 'root',
    getItemName: (item) => {
      const id = item.getItemData()
      const treeItem = treeData?.items[id]
      return treeItem?.data?.name ?? id
    },
    isItemFolder: (item) => {
      const id = item.getItemData()
      const treeItem = treeData?.items[id]
      return (treeItem?.children?.length ?? 0) > 0
    },
    dataLoader: {
      getItem: (itemId) => itemId,
      getChildren: (itemId) =>
        treeData?.items[itemId]?.children ?? [],
    },
    features: [
      syncDataLoaderFeature,
      hotkeysCoreFeature,
    ],
    scrollToItem: (item) => {
      virtualizer.scrollToIndex(item.getItemMeta().index)
    },
  })

  const items = tree.getItems()

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 5,
  })

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Failed to load classes
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Loading classes...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" data-testid="class-tree">
      <ClassTreeSearch
        searchText={searchText}
        onSearchChange={setSearchText}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        availableSources={availableSources}
      />

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div
          {...tree.getContainerProps()}
          role="tree"
          aria-label="Ontology class hierarchy"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index]
            if (!item) return null

            const itemId = item.getId()
            const treeItem = treeData?.items[itemId]
            const nodeData: ClassNodeData = treeItem?.data
              ? classToNodeData(treeItem.data)
              : { id: itemId, name: itemId }

            return (
              <div
                {...item.getProps()}
                key={itemId}
                role="treeitem"
                aria-expanded={item.isFolder() ? item.isExpanded() : undefined}
                aria-selected={selectedClassId === itemId}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ClassTreeNode
                  data={nodeData}
                  level={item.getItemMeta().level}
                  isExpanded={item.isExpanded?.() ?? false}
                  isSelected={selectedClassId === itemId}
                  hasChildren={item.isFolder()}
                  labelMode={labelMode}
                  onClick={() => setSelectedClassId(itemId)}
                  onToggle={() => {
                    if (item.isExpanded()) {
                      item.collapse?.()
                    } else {
                      item.expand?.()
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
