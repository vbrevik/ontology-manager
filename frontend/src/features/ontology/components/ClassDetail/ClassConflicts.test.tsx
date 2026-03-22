import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClassConflicts, type ConflictData } from './ClassConflicts'

const sampleConflict: ConflictData = {
  baseDefinition: { name: 'Vehicle', description: 'Base definition' },
  extensionDefinition: { name: 'Vehicle', description: 'Extended' },
  resolutionStatus: 'unresolved',
}

describe('ClassConflicts', () => {
  it('renders two columns (Base Definition, Extension Definition)', () => {
    render(<ClassConflicts conflictData={sampleConflict} />)

    expect(screen.getByText('Base Definition')).toBeInTheDocument()
    expect(screen.getByText('Extension Definition')).toBeInTheDocument()
  })

  it('shows resolution status label', () => {
    render(<ClassConflicts conflictData={sampleConflict} />)
    expect(screen.getByText('Unresolved')).toBeInTheDocument()
  })

  it('renders nothing when conflict data is null/undefined', () => {
    const { container: c1 } = render(<ClassConflicts conflictData={null} />)
    expect(c1.innerHTML).toBe('')

    const { container: c2 } = render(<ClassConflicts conflictData={undefined} />)
    expect(c2.innerHTML).toBe('')
  })
})
