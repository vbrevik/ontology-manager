import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ClassTreeSearch } from './ClassTreeSearch'

describe('ClassTreeSearch', () => {
  const defaultProps = {
    searchText: '',
    onSearchChange: vi.fn(),
    sourceFilter: null as string | null,
    onSourceFilterChange: vi.fn(),
    availableSources: [] as string[],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders search input', () => {
    render(<ClassTreeSearch {...defaultProps} />)
    expect(
      screen.getByPlaceholderText(/search classes/i),
    ).toBeInTheDocument()
  })

  it('typing in search input triggers onSearchChange (debounced 300ms)', () => {
    render(<ClassTreeSearch {...defaultProps} />)

    const input = screen.getByPlaceholderText(/search classes/i)
    fireEvent.change(input, { target: { value: 'test' } })

    // Not called yet (debounce)
    expect(defaultProps.onSearchChange).not.toHaveBeenCalled()

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('test')
  })

  it('renders source filter dropdown when classes have source_id', () => {
    render(
      <ClassTreeSearch
        {...defaultProps}
        availableSources={['source-a', 'source-b']}
      />,
    )

    expect(screen.getByLabelText(/filter by source/i)).toBeInTheDocument()
  })

  it('hides source filter dropdown when no classes have source_id', () => {
    render(<ClassTreeSearch {...defaultProps} availableSources={[]} />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('selecting a source filter triggers onSourceFilterChange', () => {
    render(
      <ClassTreeSearch
        {...defaultProps}
        availableSources={['source-a', 'source-b']}
      />,
    )

    const select = screen.getByLabelText(/filter by source/i)
    fireEvent.change(select, { target: { value: 'source-a' } })

    expect(defaultProps.onSourceFilterChange).toHaveBeenCalledWith('source-a')
  })
})
