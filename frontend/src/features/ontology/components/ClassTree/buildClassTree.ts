import type { Class } from '@/features/ontology/lib/api'

export interface TreeItem {
  children: string[]
  data?: Class
}

export interface ClassTreeData {
  rootItem: string
  items: Record<string, TreeItem>
}

export function buildClassTree(classes: Class[]): ClassTreeData {
  if (classes.length === 0) {
    return { rootItem: 'root', items: { root: { children: [] } } }
  }

  // 1. Create Map for O(1) lookup
  const classMap = new Map<string, Class>()
  for (const cls of classes) {
    classMap.set(cls.id, cls)
  }

  // 2. Group children by parent_class_id
  const childrenMap = new Map<string, string[]>()
  const rootIds: string[] = []

  for (const cls of classes) {
    const parentId = cls.parent_class_id
    if (!parentId || !classMap.has(parentId)) {
      // Root node: null parent or orphaned (parent doesn't exist)
      rootIds.push(cls.id)
    } else {
      const siblings = childrenMap.get(parentId) ?? []
      siblings.push(cls.id)
      childrenMap.set(parentId, siblings)
    }
  }

  // 3. Sort function: alphabetical by name
  const sortByName = (a: string, b: string) => {
    const nameA = classMap.get(a)?.name ?? ''
    const nameB = classMap.get(b)?.name ?? ''
    return nameA.localeCompare(nameB)
  }

  // 4. Sort root nodes
  rootIds.sort(sortByName)

  // 5. Build items record
  const items: Record<string, TreeItem> = {
    root: { children: rootIds },
  }

  for (const cls of classes) {
    const children = childrenMap.get(cls.id) ?? []
    children.sort(sortByName)
    items[cls.id] = { children, data: cls }
  }

  return { rootItem: 'root', items }
}
