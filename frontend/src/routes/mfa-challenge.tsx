import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useEffect } from 'react'
import { AlertCircle, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const Route = createFileRoute('/mfa-challenge')({
  component: MfaChallenge,
})

const mfaSchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 digits').max(8, 'Code must be at most 8 characters'),
})

type MfaFormValues = z.infer<typeof mfaSchema>

function MfaChallenge() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mfaToken, setMfaToken] = useState<string | null>(null)

  useEffect(() => {
    // Get MFA token from sessionStorage (set during login)
    const token = sessionStorage.getItem('mfa_token')
    if (!token) {
      // No MFA token found, redirect to login
      navigate({ to: '/login' })
      return
    }
    setMfaToken(token)
  }, [navigate])

  const form = useForm<MfaFormValues>({
    resolver: zodResolver(mfaSchema),
    defaultValues: {
      code: '',
    },
  })

  const onSubmit = async (values: MfaFormValues) => {
    if (!mfaToken) {
      setError('No MFA token found. Please login again.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/mfa/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mfa_token: mfaToken,
          code: values.code,
          remember_me: sessionStorage.getItem('remember_me') === 'true',
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorText = await response.text()
        setError(errorText || 'Invalid verification code. Please try again.')
        setIsLoading(false)
        return
      }

      // Success! Clear session storage and redirect
      sessionStorage.removeItem('mfa_token')
      sessionStorage.removeItem('remember_me')
      
      // Navigate to home page - AuthContext will handle state updates
      navigate({ to: '/' })
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again.')
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    // Clear session storage and return to login
    sessionStorage.removeItem('mfa_token')
    sessionStorage.removeItem('remember_me')
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="000000"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={8}
                        className="text-center text-2xl tracking-widest"
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify'}
              </Button>
            </form>
          </Form>

          <div className="mt-4 p-4 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Lost your device?</strong>
              <br />
              Use one of your backup codes instead of the 6-digit code.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel and return to login
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
