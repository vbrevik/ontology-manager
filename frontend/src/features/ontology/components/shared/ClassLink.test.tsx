import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClassLink } from './ClassLink'

describe('ClassLink', () => {
  it('renders class name as link text', () => {
    render(<ClassLink classId="123" label="Vehicle" />)
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
  })

  it('clicking calls onNavigate with correct classId', () => {
    const onNavigate = vi.fn()
    render(
      <ClassLink classId="123" label="Vehicle" onNavigate={onNavigate} />,
    )
    fireEvent.click(screen.getByText('Vehicle'))
    expect(onNavigate).toHaveBeenCalledWith('123')
  })

  it('has correct styling classes', () => {
    render(<ClassLink classId="123" label="Vehicle" />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('text-primary')
    expect(button.className).toContain('underline-offset-4')
    expect(button.className).toContain('hover:underline')
  })

  it('renders as a button element', () => {
    render(<ClassLink classId="123" label="Vehicle" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
