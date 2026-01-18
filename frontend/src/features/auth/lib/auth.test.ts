import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { requestPasswordReset, verifyResetToken, resetPassword } from './auth'

// Mock fetch globally
global.fetch = vi.fn()

describe('Password Reset API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('requestPasswordReset', () => {
    it('should successfully request password reset', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset link sent' }),
      } as Response)

      const result = await requestPasswordReset('test@example.com')

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com' }),
          credentials: 'include',
        })
      )
    })

    it('should handle server error gracefully', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      } as Response)

      const result = await requestPasswordReset('test@example.com')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Request failed')
    })

    it('should handle network error', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await requestPasswordReset('test@example.com')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should handle empty email', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset link sent' }),
      } as Response)

      const result = await requestPasswordReset('')

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        expect.objectContaining({
          body: JSON.stringify({ email: '' }),
        })
      )
    })
  })

  describe('verifyResetToken', () => {
    it('should successfully verify valid token', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      } as Response)

      const result = await verifyResetToken('valid_token_123')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/verify-reset-token/valid_token_123',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      )
    })

    it('should handle invalid token', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid or expired token',
      } as Response)

      const result = await verifyResetToken('invalid_token')

      expect(result.success).toBe(false)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid or expired token')
    })

    it('should handle expired token', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Token has expired',
      } as Response)

      const result = await verifyResetToken('expired_token')

      expect(result.success).toBe(false)
      expect(result.valid).toBe(false)
    })

    it('should handle network error', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

      const result = await verifyResetToken('token_123')

      expect(result.success).toBe(false)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network timeout')
    })
  })

  describe('resetPassword', () => {
    it('should successfully reset password', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successfully' }),
      } as Response)

      const result = await resetPassword('valid_token', 'NewPassword123!')

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'valid_token',
            new_password: 'NewPassword123!',
          }),
          credentials: 'include',
        })
      )
    })

    it('should handle invalid token during reset', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid or expired token',
      } as Response)

      const result = await resetPassword('invalid_token', 'NewPassword123!')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid or expired token')
    })

    it('should handle weak password validation', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Password must be at least 8 characters',
      } as Response)

      const result = await resetPassword('valid_token', 'weak')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Password must be at least 8 characters')
    })

    it('should handle network error during reset', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'))

      const result = await resetPassword('token', 'Password123!')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('should handle empty password', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Password cannot be empty',
      } as Response)

      const result = await resetPassword('token', '')

      expect(result.success).toBe(false)
    })

    it('should handle server error', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      } as Response)

      const result = await resetPassword('token', 'Password123!')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Internal server error')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete password reset flow', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>

      // Step 1: Request reset
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset link sent' }),
      } as Response)

      const requestResult = await requestPasswordReset('test@example.com')
      expect(requestResult.success).toBe(true)

      // Step 2: Verify token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      } as Response)

      const verifyResult = await verifyResetToken('token_123')
      expect(verifyResult.success).toBe(true)
      expect(verifyResult.valid).toBe(true)

      // Step 3: Reset password
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successfully' }),
      } as Response)

      const resetResult = await resetPassword('token_123', 'NewPassword123!')
      expect(resetResult.success).toBe(true)

      // Verify all API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle token expiration during multi-step flow', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>

      // Request reset succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset link sent' }),
      } as Response)

      await requestPasswordReset('test@example.com')

      // Token verification succeeds initially
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      } as Response)

      await verifyResetToken('token_123')

      // But token expires before reset attempt
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Token has expired',
      } as Response)

      const result = await resetPassword('token_123', 'NewPassword123!')
      expect(result.success).toBe(false)
      expect(result.error).toContain('expired')
    })
  })

  describe('Security considerations', () => {
    it('should not expose email existence through different error messages', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>

      // Non-existent email should return generic success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'If account exists, reset link sent' }),
      } as Response)

      const result1 = await requestPasswordReset('nonexistent@example.com')
      expect(result1.success).toBe(true)

      // Existing email should return same message
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'If account exists, reset link sent' }),
      } as Response)

      const result2 = await requestPasswordReset('existing@example.com')
      expect(result2.success).toBe(true)
    })

    it('should include credentials in all requests', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response)

      await requestPasswordReset('test@example.com')
      await verifyResetToken('token')
      await resetPassword('token', 'password')

      const calls = mockFetch.mock.calls
      calls.forEach((call) => {
        const options = call[1] as RequestInit
        expect(options.credentials).toBe('include')
      })
    })
  })
})
