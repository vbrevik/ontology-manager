import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/features/auth/lib/context'
import { MfaChallenge } from '@/features/auth/components/MfaChallenge'

export const Route = createFileRoute('/login')({
  component: Login,
})

const loginSchema = z.object({
  identifier: z.string().min(3, 'Username or email must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().default(false),
})

type LoginFormValues = z.infer<typeof loginSchema>

function Login() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showMfa, setShowMfa] = useState(false)
  const [mfaUserId, setMfaUserId] = useState<string | null>(null)
  const [mfaRememberMe, setMfaRememberMe] = useState(false)
  const { login } = useAuth()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
      rememberMe: false,
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await login(values.identifier, values.password, values.rememberMe)

      // Check if MFA is required (new MFA integration)
      if (result.success && result.mfaRequired) {
        // Store MFA token and remember_me preference in sessionStorage
        if (result.mfaToken) {
          sessionStorage.setItem('mfa_token', result.mfaToken)
          sessionStorage.setItem('remember_me', values.rememberMe ? 'true' : 'false')
          // Redirect to MFA challenge page
          navigate({ to: '/mfa-challenge' })
          return
        }
        // Fallback to old MFA flow (if mfaToken not present)
        if (result.userId) {
          setMfaUserId(result.userId)
          setMfaRememberMe(values.rememberMe)
          setShowMfa(true)
          setIsLoading(false)
          return
        }
      }

      if (!result.success) {
        setError(result.error || 'Login failed. Please check your credentials.')
        setIsLoading(false)
        return
      }

      // Navigate to home page - AuthContext will handle state updates
      navigate({ to: '/' })
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (showMfa && mfaUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <MfaChallenge
          userId={mfaUserId}
          rememberMe={mfaRememberMe}
          onSuccess={() => navigate({ to: '/' })}
          onCancel={() => setShowMfa(false)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Sign in
          </CardTitle>
          <CardDescription>
            Enter your username or email and password to access your account
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
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username or Email</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="username or email@example.com"
                        autoComplete="username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-sm font-medium text-primary hover:underline text-muted-foreground"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                          Remember me
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-primary underline-offset-4 hover:underline font-medium"
            >
              Create an account
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
