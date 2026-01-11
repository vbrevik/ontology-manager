import { useState, useEffect, useRef, useCallback } from 'react'

export interface IdleTimerOptions {
    /** Timeout in milliseconds before warning is shown */
    warningTimeout: number
    /** Timeout in milliseconds before auto-logout (should be > warningTimeout) */
    logoutTimeout: number
    /** Callback when warning threshold is reached */
    onWarning: () => void
    /** Callback when logout threshold is reached */
    onLogout: () => void
    /** Whether the timer is enabled */
    enabled?: boolean
}

/**
 * Hook to detect user idleness and trigger warnings/logout
 */
export function useIdleTimer({
    warningTimeout,
    logoutTimeout,
    onWarning,
    onLogout,
    enabled = true,
}: IdleTimerOptions) {
    const [isIdle, setIsIdle] = useState(false)
    const [showWarning, setShowWarning] = useState(false)
    const [timeUntilLogout, setTimeUntilLogout] = useState(0)

    const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
    const logoutTimerRef = useRef<NodeJS.Timeout | null>(null)
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const lastActivityRef = useRef(Date.now())

    const clearTimers = useCallback(() => {
        if (warningTimerRef.current) {
            clearTimeout(warningTimerRef.current)
            warningTimerRef.current = null
        }
        if (logoutTimerRef.current) {
            clearTimeout(logoutTimerRef.current)
            logoutTimerRef.current = null
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
        }
    }, [])

    const startCountdown = useCallback(() => {
        const warningTime = Date.now()

        // Clear any existing countdown
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
        }

        // Update countdown every second
        countdownIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - warningTime
            const remaining = Math.max(0, logoutTimeout - warningTimeout - elapsed)
            setTimeUntilLogout(Math.floor(remaining / 1000))

            if (remaining <= 0) {
                clearInterval(countdownIntervalRef.current!)
                countdownIntervalRef.current = null
            }
        }, 1000)

        // Set initial value
        const remaining = logoutTimeout - warningTimeout
        setTimeUntilLogout(Math.floor(remaining / 1000))
    }, [logoutTimeout, warningTimeout])

    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now()
        setIsIdle(false)
        setShowWarning(false)
        clearTimers()

        if (!enabled) return

        // Set warning timer
        warningTimerRef.current = setTimeout(() => {
            setIsIdle(true)
            setShowWarning(true)
            startCountdown()
            onWarning()
        }, warningTimeout)

        // Set logout timer
        logoutTimerRef.current = setTimeout(() => {
            setIsIdle(true)
            setShowWarning(false)
            onLogout()
        }, logoutTimeout)
    }, [enabled, warningTimeout, logoutTimeout, onWarning, onLogout, clearTimers, startCountdown])

    useEffect(() => {
        if (!enabled) {
            clearTimers()
            setShowWarning(false)
            setIsIdle(false)
            return
        }

        // Activity events to track
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']

        // Throttle activity tracking to avoid too many resets
        let throttleTimeout: NodeJS.Timeout | null = null
        const handleActivity = () => {
            if (throttleTimeout) return

            throttleTimeout = setTimeout(() => {
                throttleTimeout = null
            }, 1000) // Throttle to once per second

            resetTimer()
        }

        // Initialize timer
        resetTimer()

        // Add event listeners
        events.forEach(event => {
            window.addEventListener(event, handleActivity)
        })

        // Cleanup
        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleActivity)
            })
            clearTimers()
            if (throttleTimeout) {
                clearTimeout(throttleTimeout)
            }
        }
    }, [enabled, resetTimer, clearTimers])

    return {
        isIdle,
        showWarning,
        timeUntilLogout,
        resetTimer,
    }
}
