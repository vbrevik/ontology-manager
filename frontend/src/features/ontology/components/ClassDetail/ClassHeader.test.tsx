import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClassHeader } from './ClassHeader'
import type { Class } from '@/features/ontology/lib/api'

vi.mock('../shared/SourceBadge', () => ({
  SourceBadge: ({ sourceId }: { sourceId: string }) => (
    <span data-testid="source-badge">{sourceId}</span>
  ),
}))

vi.mock('../shared/ClassLink', () => ({
  ClassLink: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="class-link">{children}</span>
  ),
}))

function makeClass(overrides: Partial<Class> = {}): Class {
  return {
    id: 'cls-1',
    name: 'Vehicle',
    version_id: 'v1',
    is_abstract: false,
    attributes: {},
    created_at: '2026-01-01',
    ...overrides,
  }
}

describe('ClassHeader', () => {
  it('renders class name as read-only text (not editable)', () => {
    render(<ClassHeader classData={makeClass({ name: 'Vehicle' })} />)
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders parent class as clickable ClassLink', () => {
    render(
      <ClassHeader
        classData={makeClass({ parent_class_id: 'parent-1' })}
        parentClassName="TransportMode"
      />,
    )
    expect(screen.getByTestId('class-link')).toBeInTheDocument()
    expect(screen.getByText('TransportMode')).toBeInTheDocument()
  })

  it('renders SourceBadge when source_id present', () => {
    const cls = { ...makeClass(), source_id: 'src-1' } as any
    render(<ClassHeader classData={cls} />)
    expect(screen.getByTestId('source-badge')).toBeInTheDocument()
  })

  it('hides SourceBadge when source_id absent', () => {
    render(<ClassHeader classData={makeClass()} />)
    expect(screen.queryByTestId('source-badge')).not.toBeInTheDocument()
  })

  it('renders description text', () => {
    render(
      <ClassHeader
        classData={makeClass({ description: 'A motorized vehicle' })}
      />,
    )
    expect(screen.getByText('A motorized vehicle')).toBeInTheDocument()
  })
})
