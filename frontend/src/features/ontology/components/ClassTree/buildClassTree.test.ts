import { describe, it, expect } from 'vitest'
import { buildClassTree } from './buildClassTree'
import type { Class } from '@/features/ontology/lib/api'

function makeClass(overrides: {
  id: string
  name: string
  parent_class_id?: string | null
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
  } as Class
}

describe('buildClassTree', () => {
  it('returns empty tree structure when class list is empty', () => {
    const result = buildClassTree([])
    expect(result.rootItem).toBe('root')
    expect(result.items.root.children).toEqual([])
  })

  it('handles single root node', () => {
    const classes = [makeClass({ id: '1', name: 'Thing' })]
    const result = buildClassTree(classes)
    expect(result.items.root.children).toEqual(['1'])
    expect(result.items['1'].data?.name).toBe('Thing')
    expect(result.items['1'].children).toEqual([])
  })

  it('handles multiple root nodes', () => {
    const classes = [
      makeClass({ id: '1', name: 'Animal' }),
      makeClass({ id: '2', name: 'Plant' }),
    ]
    const result = buildClassTree(classes)
    expect(result.items.root.children).toEqual(['1', '2'])
  })

  it('root nodes are those with parent_class_id === null', () => {
    const classes = [
      makeClass({ id: '1', name: 'Root', parent_class_id: null }),
      makeClass({ id: '2', name: 'Child', parent_class_id: '1' }),
    ]
    const result = buildClassTree(classes)
    expect(result.items.root.children).toEqual(['1'])
    expect(result.items['1'].children).toEqual(['2'])
  })

  it('groups children by parent_class_id', () => {
    const classes = [
      makeClass({ id: '1', name: 'Parent' }),
      makeClass({ id: '2', name: 'ChildA', parent_class_id: '1' }),
      makeClass({ id: '3', name: 'ChildB', parent_class_id: '1' }),
    ]
    const result = buildClassTree(classes)
    expect(result.items['1'].children).toEqual(['2', '3'])
  })

  it('handles deeply nested hierarchy (3+ levels)', () => {
    const classes = [
      makeClass({ id: '1', name: 'L1' }),
      makeClass({ id: '2', name: 'L2', parent_class_id: '1' }),
      makeClass({ id: '3', name: 'L3', parent_class_id: '2' }),
    ]
    const result = buildClassTree(classes)
    expect(result.items.root.children).toEqual(['1'])
    expect(result.items['1'].children).toEqual(['2'])
    expect(result.items['2'].children).toEqual(['3'])
    expect(result.items['3'].children).toEqual([])
  })

  it('handles class with no children (leaf node)', () => {
    const classes = [makeClass({ id: '1', name: 'Leaf' })]
    const result = buildClassTree(classes)
    expect(result.items['1'].children).toEqual([])
  })

  it('orphaned nodes (parent_class_id references non-existent parent) become root nodes', () => {
    const classes = [
      makeClass({ id: '1', name: 'Orphan', parent_class_id: 'nonexistent' }),
    ]
    const result = buildClassTree(classes)
    expect(result.items.root.children).toEqual(['1'])
  })

  it('children are sorted alphabetically by name at each level', () => {
    const classes = [
      makeClass({ id: '1', name: 'Parent' }),
      makeClass({ id: '2', name: 'Zebra', parent_class_id: '1' }),
      makeClass({ id: '3', name: 'Apple', parent_class_id: '1' }),
      makeClass({ id: '4', name: 'Mango', parent_class_id: '1' }),
    ]
    const result = buildClassTree(classes)
    expect(result.items['1'].children).toEqual(['3', '4', '2'])
  })

  it('converts to headless-tree format with rootItem, items record, and children arrays', () => {
    const classes = [
      makeClass({ id: '1', name: 'Root' }),
      makeClass({ id: '2', name: 'Child', parent_class_id: '1' }),
    ]
    const result = buildClassTree(classes)

    expect(result.rootItem).toBe('root')
    expect(result.items).toHaveProperty('root')
    expect(result.items).toHaveProperty('1')
    expect(result.items).toHaveProperty('2')
    expect(result.items.root.children).toEqual(['1'])
    expect(result.items['1'].children).toEqual(['2'])
    expect(result.items['1'].data).toBeDefined()
    expect(result.items['2'].data).toBeDefined()
    expect(result.items.root.data).toBeUndefined()
  })
})
