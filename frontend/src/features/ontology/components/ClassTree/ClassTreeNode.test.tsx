import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClassTreeNode, type ClassNodeData } from './ClassTreeNode'

// Mock shared components (section 06 stubs)
vi.mock('../shared/SourceBadge', () => ({
  SourceBadge: ({ sourceId }: { sourceId: string }) => (
    <span data-testid="source-badge">{sourceId}</span>
  ),
}))

vi.mock('../shared/ConflictBadge', () => ({
  ConflictBadge: () => <span data-testid="conflict-badge">conflict</span>,
}))

function makeNodeData(overrides: Partial<ClassNodeData> = {}): ClassNodeData {
  return {
    id: 'class-1',
    name: 'TestClass',
    ...overrides,
  }
}

const defaultProps = {
  level: 0,
  isExpanded: false,
  isSelected: false,
  hasChildren: false,
  labelMode: 'name' as const,
  onClick: vi.fn(),
  onToggle: vi.fn(),
}

describe('ClassTreeNode', () => {
  it('renders class name', () => {
    render(
      <ClassTreeNode {...defaultProps} data={makeNodeData({ name: 'Vehicle' })} />,
    )
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
  })

  it('renders description when labelMode is "description"', () => {
    render(
      <ClassTreeNode
        {...defaultProps}
        labelMode="description"
        data={makeNodeData({ name: 'Vehicle', description: 'A thing that moves' })}
      />,
    )
    expect(screen.getByText('A thing that moves')).toBeInTheDocument()
  })

  it('indentation increases with tree depth level', () => {
    const { container } = render(
      <ClassTreeNode {...defaultProps} data={makeNodeData()} level={3} />,
    )
    const node = container.firstElementChild as HTMLElement
    expect(node.style.paddingLeft).toBe('60px')
  })

  it('shows chevron only when node has children', () => {
    const { rerender } = render(
      <ClassTreeNode {...defaultProps} data={makeNodeData()} hasChildren />,
    )
    expect(screen.getByTestId('tree-chevron')).toBeInTheDocument()

    rerender(
      <ClassTreeNode {...defaultProps} data={makeNodeData()} hasChildren={false} />,
    )
    expect(screen.queryByTestId('tree-chevron')).not.toBeInTheDocument()
  })

  it('rotates chevron when node is expanded', () => {
    render(
      <ClassTreeNode
        {...defaultProps}
        data={makeNodeData()}
        hasChildren
        isExpanded
      />,
    )
    const chevron = screen.getByTestId('tree-chevron')
    expect(chevron.className).toContain('rotate-90')
  })

  it('renders SourceBadge when source_id present', () => {
    render(
      <ClassTreeNode
        {...defaultProps}
        data={makeNodeData({ source_id: 'src-1' })}
      />,
    )
    expect(screen.getByTestId('source-badge')).toBeInTheDocument()
  })

  it('does not render SourceBadge when source_id absent', () => {
    render(<ClassTreeNode {...defaultProps} data={makeNodeData()} />)
    expect(screen.queryByTestId('source-badge')).not.toBeInTheDocument()
  })

  it('renders conflict icon when conflict data present', () => {
    render(
      <ClassTreeNode
        {...defaultProps}
        data={makeNodeData({ hasConflict: true })}
      />,
    )
    expect(screen.getByTestId('conflict-badge')).toBeInTheDocument()
  })

  it('does not render conflict icon when conflict data absent', () => {
    render(
      <ClassTreeNode
        {...defaultProps}
        data={makeNodeData({ hasConflict: false })}
      />,
    )
    expect(screen.queryByTestId('conflict-badge')).not.toBeInTheDocument()
  })
})
