import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type AuthState, getUserInfo, login as loginApi, register as registerApi, logout as logoutApi, refreshSession } from './auth'
import { useIdleTimer } from '@/hooks/useIdleTimer'
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning'

interface AuthContextType extends AuthState {
    login: typeof loginApi
    register: typeof registerApi
    logout: typeof logoutApi
    refreshAuth: () => Promise<void>
    hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Session timeout configuration (in milliseconds)
const IDLE_WARNING_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const IDLE_LOGOUT_TIMEOUT = 35 * 60 * 1000 // 35 minutes (5 min grace period)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: true,
    })

    // Check authentication status
    const checkAuth = async () => {
        // Get user info from API (this checks the HttpOnly cookie)
        const userInfo = await getUserInfo()

        if (userInfo) {
            setAuthState({
                user: userInfo,
                isAuthenticated: true,
                isLoading: false,
            })
        } else {
            setAuthState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            })
        }
    }

    // Idle timer callbacks
    const handleIdleWarning = () => {
        // Warning will be shown via showWarning state from useIdleTimer
        console.log('Session timeout warning triggered')
    }

    const handleIdleLogout = () => {
        console.log('Session expired due to inactivity')
        logout()
    }

    const handleExtendSession = async () => {
        const success = await refreshSession()
        if (success) {
            // Reset the idle timer
            resetTimer()
        } else {
            // Refresh failed, force logout
            logout()
        }
    }

    // Idle timer hook
    const { showWarning, timeUntilLogout, resetTimer } = useIdleTimer({
        warningTimeout: IDLE_WARNING_TIMEOUT,
        logoutTimeout: IDLE_LOGOUT_TIMEOUT,
        onWarning: handleIdleWarning,
        onLogout: handleIdleLogout,
        enabled: authState.isAuthenticated,
    })

    useEffect(() => {
        // Check authentication status on mount
        checkAuth()

        // Listen for storage changes (for logout from other tabs)
        const handleStorageChange = () => {
            checkAuth()
        }

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [])

    // Provide the auth state methods wrapped with state updates
    const login = async (identifier: string, password: string, rememberMe: boolean = false) => {
        const result = await loginApi(identifier, password, rememberMe)
        if (result.success) {
            await checkAuth()
        }
        return result
    }

    const register = async (username: string, email: string, password: string) => {
        const result = await registerApi(username, email, password)
        if (result.success) {
            await checkAuth()
        }
        return result
    }

    const logout = () => {
        logoutApi()
        setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
        })
    }

    const value = {
        ...authState,
        login,
        register,
        logout,
        refreshAuth: checkAuth,
        hasPermission: (permission: string) => {
            if (!authState.user || !authState.user.permissions) return false;

            // Support wildcard check if backend returns it (e.g. '*')
            if (authState.user.permissions.includes('*')) return true;

            return authState.user.permissions.includes(permission);
        }
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
            <SessionTimeoutWarning
                open={showWarning}
                timeRemaining={timeUntilLogout}
                onExtend={handleExtendSession}
                onLogout={logout}
            />
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
