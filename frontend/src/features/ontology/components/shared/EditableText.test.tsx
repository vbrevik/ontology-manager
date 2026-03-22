import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableText } from './EditableText'

describe('EditableText', () => {
  it('displays text in view mode', () => {
    render(<EditableText value="Hello" onSave={vi.fn()} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows edit icon on hover', async () => {
    const user = userEvent.setup()
    render(<EditableText value="Hello" onSave={vi.fn()} />)
    await user.hover(screen.getByText('Hello'))
    expect(screen.getByTestId('editable-text-icon')).toBeInTheDocument()
  })

  it('clicking switches to edit mode with input', async () => {
    const user = userEvent.setup()
    render(<EditableText value="Hello" onSave={vi.fn()} />)
    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Hello')
  })

  it('input is auto-focused in edit mode', async () => {
    const user = userEvent.setup()
    render(<EditableText value="Hello" onSave={vi.fn()} />)
    await user.click(screen.getByText('Hello'))
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('pressing Enter saves', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<EditableText value="Hello" onSave={onSave} />)
    await user.click(screen.getByText('Hello'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Updated{Enter}')
    expect(onSave).toHaveBeenCalledWith('Updated')
  })

  it('blur saves', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<EditableText value="Hello" onSave={onSave} />)
    await user.click(screen.getByText('Hello'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Updated')
    await user.tab()
    expect(onSave).toHaveBeenCalledWith('Updated')
  })

  it('pressing Escape cancels without saving', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<EditableText value="Hello" onSave={onSave} />)
    await user.click(screen.getByText('Hello'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Changed')
    await user.keyboard('{Escape}')
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders textarea when multiline is true', async () => {
    const user = userEvent.setup()
    render(<EditableText value="Hello" onSave={vi.fn()} multiline />)
    await user.click(screen.getByText('Hello'))
    const textarea = screen.getByRole('textbox')
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('input is disabled during loading', () => {
    render(<EditableText value="Hello" onSave={vi.fn()} loading />)
    // When loading, show the value with a spinner, no edit mode
    expect(screen.getByTestId('editable-text-spinner')).toBeInTheDocument()
  })
})
