import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateClassDialog } from './CreateClassDialog'

const mockCreateClass = vi.fn()
const mockFetchCurrentVersion = vi.fn()

vi.mock('@/features/ontology/lib/api', () => ({
  createClass: (...args: unknown[]) => mockCreateClass(...args),
  fetchCurrentVersion: () => mockFetchCurrentVersion(),
  fetchClasses: () => Promise.resolve([]),
}))

vi.mock('../OntologyBrowserContext', () => ({
  useOntologyBrowser: () => ({
    setSelectedClassId: vi.fn(),
  }),
}))

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('CreateClassDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchCurrentVersion.mockResolvedValue({ id: 'v1', name: 'v1' })
  })

  it('opens dialog on button click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateClassDialog />)
    await user.click(screen.getByRole('button', { name: /new class/i }))
    expect(screen.getByText('Create New Class')).toBeInTheDocument()
  })

  it('requires class name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateClassDialog />)
    await user.click(screen.getByRole('button', { name: /new class/i }))
    await user.click(screen.getByRole('button', { name: /create/i }))
    expect(screen.getByText('Class name is required')).toBeInTheDocument()
    expect(mockCreateClass).not.toHaveBeenCalled()
  })

  it('submits with name and calls createClass', async () => {
    mockCreateClass.mockResolvedValue({ id: 'new-1', name: 'MyClass' })
    const user = userEvent.setup()
    renderWithProviders(<CreateClassDialog />)
    await user.click(screen.getByRole('button', { name: /new class/i }))
    await user.type(screen.getByPlaceholderText('Class name'), 'MyClass')
    await user.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => {
      expect(mockCreateClass).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'MyClass', version_id: 'v1' }),
      )
    })
  })

  it('closes dialog on success', async () => {
    mockCreateClass.mockResolvedValue({ id: 'new-1', name: 'MyClass' })
    const user = userEvent.setup()
    renderWithProviders(<CreateClassDialog />)
    await user.click(screen.getByRole('button', { name: /new class/i }))
    await user.type(screen.getByPlaceholderText('Class name'), 'MyClass')
    await user.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => {
      expect(screen.queryByText('Create New Class')).not.toBeInTheDocument()
    })
  })

  it('shows error on failure', async () => {
    mockCreateClass.mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    renderWithProviders(<CreateClassDialog />)
    await user.click(screen.getByRole('button', { name: /new class/i }))
    await user.type(screen.getByPlaceholderText('Class name'), 'MyClass')
    await user.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })
})
