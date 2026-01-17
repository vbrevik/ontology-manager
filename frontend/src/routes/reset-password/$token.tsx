import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

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
import { resetPassword, verifyResetToken } from '@/features/auth/lib/auth'

export const Route = createFileRoute('/reset-password/$token')({
    component: ResetPassword,
})

const resetPasswordSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

function ResetPassword() {
    const { token } = Route.useParams()
    const navigate = useNavigate()

    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<boolean>(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isVerifying, setIsVerifying] = useState(true)
    const [isValidToken, setIsValidToken] = useState(false)

    // Verify token on mount
    useEffect(() => {
        async function checkToken() {
            if (!token) {
                setIsVerifying(false)
                return
            }

            const result = await verifyResetToken(token)
            if (result.success && result.valid) {
                setIsValidToken(true)
            } else {
                setError('Invalid or expired password reset link.')
            }
            setIsVerifying(false)
        }
        checkToken()
    }, [token])

    const form = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        },
    })

    const onSubmit = async (values: ResetPasswordFormValues) => {
        setIsLoading(true)
        setError(null)

        try {
            const result = await resetPassword(token, values.password)

            if (!result.success) {
                setError(result.error || 'Failed to reset password.')
                setIsLoading(false)
                return
            }

            setSuccess(true)
            // Redirect to login after a short delay so user sees success message
            setTimeout(() => {
                navigate({ to: '/login' })
            }, 3000)

        } catch (err: any) {
            setError(err.message || 'Network error. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    if (isVerifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
                <div className="text-center">Verifying link...</div>
            </div>
        )
    }

    if (!isValidToken) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-destructive">Invalid Link</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>This password reset link is invalid or has expired.</p>
                    </CardContent>
                    <CardFooter>
                        <Link to="/forgot-password" className="text-primary hover:underline">Request a new one</Link>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        Reset Password
                    </CardTitle>
                    <CardDescription>
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="space-y-4">
                            <Alert className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertDescription>
                                    Password reset successfully! Redirecting to login...
                                </AlertDescription>
                            </Alert>
                            <Button className="w-full" onClick={() => navigate({ to: '/login' })}>
                                Sign In Now
                            </Button>
                        </div>
                    ) : (
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
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>New Password</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    placeholder="Enter new password"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirm Password</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    placeholder="Confirm new password"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Resetting...' : 'Reset Password'}
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
