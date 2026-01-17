import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './context'
import * as authApi from './auth'
import { useNavigate } from '@tanstack/react-router'

// Mock the router
vi.mock('@tanstack/react-router', () => ({
    useRouter: vi.fn(),
    useNavigate: vi.fn(),
}))

// Mock auth API
vi.mock('./auth', () => ({
    getUserInfo: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
}))

// Mock idle timer
let triggerOnLogout: (() => void) | null = null
let mockShowWarning = false
const mockResetTimer = vi.fn()

vi.mock('@/hooks/useIdleTimer', () => ({
    useIdleTimer: ({ onLogout, enabled }: any) => {
        // Capture callbacks to trigger them in tests
        if (enabled) {
            triggerOnLogout = onLogout
        }
        return {
            showWarning: mockShowWarning,
            timeUntilLogout: 300,
            resetTimer: mockResetTimer,
        }
    }
}))

// We need to mock SessionTimeoutWarning because it renders via Portal (AlertDialog) 
// which might be tricky in pure DOM unless handled carefully. 
// Simpler to check if it's rendered with correct props? 
// Or just let it render if we have jsdom. Portal needs 'uibody'?
// radax-ui usually works in jsdom.

// Test component to consume auth context
const TestConsumer = () => {
    const { user, isAuthenticated, isLoading, login, logout, hasPermission } = useAuth()

    if (isLoading) return <div>Loading...</div>

    return (
        <div>
            <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
            {user && <div data-testid="username">{user.username}</div>}
            <button onClick={() => login('test', 'pass')}>Login</button>
            <button onClick={() => logout()}>Logout</button>
            <div data-testid="perm-check">{hasPermission('admin') ? 'Has Admin' : 'No Admin'}</div>
        </div>
    )
}

describe('AuthProvider', () => {
    const mockNavigate = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    })

    it('shows loading state initially', () => {
        vi.mocked(authApi.getUserInfo).mockReturnValue(new Promise(() => { })) // Never resolves
        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        )
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('initializes as not authenticated if getUserInfo returns null', async () => {
        vi.mocked(authApi.getUserInfo).mockResolvedValue(null)

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated')
        })
    })

    it('initializes as authenticated if getUserInfo returns user', async () => {
        const mockUser = { id: '1', username: 'testuser', email: 'test@example.com', permissions: ['read'] }
        vi.mocked(authApi.getUserInfo).mockResolvedValue(mockUser)

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
            expect(screen.getByTestId('username')).toHaveTextContent('testuser')
        })
    })

    it('updates state on successful login', async () => {
        vi.mocked(authApi.getUserInfo).mockResolvedValueOnce(null) // First check fails
        vi.mocked(authApi.login).mockResolvedValue({ success: true })
        const mockUser = { id: '1', username: 'testuser', email: 'test@example.com', permissions: [] }
        vi.mocked(authApi.getUserInfo).mockResolvedValueOnce(mockUser) // Second check succeeds

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated'))

        await act(async () => {
            screen.getByText('Login').click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
        })
    })

    it('logs out and redirects', async () => {
        const mockUser = { id: '1', username: 'testuser', email: 'test@example.com', permissions: [] }
        vi.mocked(authApi.getUserInfo).mockResolvedValue(mockUser)

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        )

        await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated'))

        await act(async () => {
            screen.getByText('Logout').click()
        })

        expect(authApi.logout).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated')
    })

    it('updates state on successful registration', async () => {
        vi.mocked(authApi.getUserInfo).mockResolvedValueOnce(null)
        vi.mocked(authApi.register).mockResolvedValue({ success: true })
        const mockUser = { id: '1', username: 'testuser', email: 'test@example.com', permissions: [] }
        vi.mocked(authApi.getUserInfo).mockResolvedValueOnce(mockUser)

        const RegisterConsumer = () => {
            const { register, isAuthenticated } = useAuth()
            return (
                <div>
                    <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
                    <button onClick={() => register('u', 'e', 'p')}>Register</button>
                </div>
            )
        }

        render(
            <AuthProvider>
                <RegisterConsumer />
            </AuthProvider>
        )

        screen.getByText('Register').click()

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
        })
    })

    describe('hasPermission', () => {
        it('returns true if user has specific permission', async () => {
            const mockUser = { id: '1', username: 'test', email: 't@t.com', permissions: ['admin'] }
            vi.mocked(authApi.getUserInfo).mockResolvedValue(mockUser)

            render(
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            )

            await waitFor(() => expect(screen.getByTestId('perm-check')).toHaveTextContent('Has Admin'))
        })

        it('returns false if user lacks permission', async () => {
            const mockUser = { id: '1', username: 'test', email: 't@t.com', permissions: ['read'] }
            vi.mocked(authApi.getUserInfo).mockResolvedValue(mockUser)

            render(
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            )

            await waitFor(() => expect(screen.getByTestId('perm-check')).toHaveTextContent('No Admin'))
        })

        it('returns true if user has wildcard', async () => {
            const mockUser = { id: '1', username: 'test', email: 't@t.com', permissions: ['*'] }
            vi.mocked(authApi.getUserInfo).mockResolvedValue(mockUser)

            render(
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            )

            await waitFor(() => expect(screen.getByTestId('perm-check')).toHaveTextContent('Has Admin'))
        })
    })

    it('throws error if useAuth is used outside provider', () => {
        // Suppress console.error for this test as React logs the error
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider')

        consoleSpy.mockRestore()
    })

    describe('Session Management', () => {
        beforeEach(() => {
            // Reset triggers
            triggerOnLogout = null
            mockShowWarning = false
        })

        it('logs out when idle timer triggers logout', async () => {
            const mockUser = { id: '1', username: 'test', email: 'test@example.com', permissions: [] }
            vi.mocked(authApi.getUserInfo).mockResolvedValue(mockUser)

            render(
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            )

            await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated'))

            // Trigger logout callback
            await act(async () => {
                if (triggerOnLogout) triggerOnLogout()
            })

            expect(authApi.logout).toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
        })

        it('extends session when requested', async () => {
            mockShowWarning = true // Force warning to show
            vi.mocked(authApi.getUserInfo).mockResolvedValue({ id: '1', username: 'test', email: 't@t.com' })
            vi.mocked(authApi.refreshSession).mockResolvedValue(true)

            render(
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            )

            // Warning dialog should be visible (using portal, so query by text)
            // Note: radax-ui AlertDialog usually renders at document body level
            await waitFor(() => {
                expect(screen.getByText(/Session Expiring Soon/i)).toBeInTheDocument()
            })

            const extendBtn = screen.getByText(/Extend Session/i)
            await act(async () => {
                extendBtn.click()
            })

            expect(authApi.refreshSession).toHaveBeenCalled()
            expect(mockResetTimer).toHaveBeenCalled()
        })

        it('refreshes auth on storage event (cross-tab sync)', async () => {
            vi.mocked(authApi.getUserInfo).mockResolvedValue(null) // Initially unauthenticated

            render(
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            )

            await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated'))

            // Simulate login in another tab
            const mockUser = { id: '1', username: 'synced_user', email: 'sync@t.com', permissions: [] }
            vi.mocked(authApi.getUserInfo).mockResolvedValue(mockUser)

            await act(async () => {
                window.dispatchEvent(new Event('storage'))
            })

            await waitFor(() => {
                expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
                expect(screen.getByTestId('username')).toHaveTextContent('synced_user')
            })
        })
    })
})
