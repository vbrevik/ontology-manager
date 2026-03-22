import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConflictBadge } from './ConflictBadge'
import { TooltipProvider } from '@/components/ui/tooltip'

describe('ConflictBadge', () => {
  it('renders AlertTriangle icon', () => {
    render(
      <TooltipProvider>
        <ConflictBadge />
      </TooltipProvider>,
    )
    expect(screen.getByTestId('conflict-badge')).toBeInTheDocument()
    const svg = screen.getByTestId('conflict-badge').querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('shows tooltip on hover', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider delayDuration={0}>
        <ConflictBadge />
      </TooltipProvider>,
    )
    await user.hover(screen.getByTestId('conflict-badge'))
    const matches = await screen.findAllByText(
      'This class has conflicting definitions from multiple sources.',
    )
    expect(matches.length).toBeGreaterThan(0)
  })
})
