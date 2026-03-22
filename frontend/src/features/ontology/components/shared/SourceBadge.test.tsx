import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SourceBadge } from './SourceBadge'

describe('SourceBadge', () => {
  it('renders badge with abbreviated source name', () => {
    render(<SourceBadge sourceId="abc-123" sourceName="SystemCore" />)
    expect(screen.getByText('SYST')).toBeInTheDocument()
  })

  it('abbreviates sourceId when sourceName is not provided', () => {
    render(<SourceBadge sourceId="abc-123" />)
    expect(screen.getByText('ABC-')).toBeInTheDocument()
  })

  it('generates consistent color from sourceId hash', () => {
    const { container } = render(<SourceBadge sourceId="abc-123" />)
    const badge = container.querySelector('[style]')
    expect(badge).not.toBeNull()
    expect(badge!.getAttribute('style')).toMatch(/background-color/)
  })

  it('same sourceId always produces same color', () => {
    const { container: c1 } = render(<SourceBadge sourceId="test-id" />)
    const { container: c2 } = render(<SourceBadge sourceId="test-id" />)
    const color1 = c1.querySelector('[style]')?.getAttribute('style')
    const color2 = c2.querySelector('[style]')?.getAttribute('style')
    expect(color1).toBe(color2)
  })

  it('renders nothing when sourceId is null', () => {
    const { container } = render(<SourceBadge sourceId={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when sourceId is undefined', () => {
    const { container } = render(<SourceBadge sourceId={undefined} />)
    expect(container.innerHTML).toBe('')
  })

  it('clicking badge triggers source filter callback', () => {
    const onSourceClick = vi.fn()
    render(
      <SourceBadge sourceId="abc-123" onSourceClick={onSourceClick} />,
    )
    fireEvent.click(screen.getByText('ABC-'))
    expect(onSourceClick).toHaveBeenCalledWith('abc-123')
  })
})
