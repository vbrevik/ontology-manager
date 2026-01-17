import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState } from 'react'
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
import { requestPasswordReset } from '@/features/auth/lib/auth'

export const Route = createFileRoute('/forgot-password')({
    component: ForgotPassword,
})

const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

function ForgotPassword() {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<boolean>(false)
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<ForgotPasswordFormValues>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: '',
        },
    })

    const onSubmit = async (values: ForgotPasswordFormValues) => {
        setIsLoading(true)
        setError(null)
        setSuccess(false)

        try {
            const result = await requestPasswordReset(values.email)

            if (!result.success) {
                setError(result.error || 'Failed to request password reset.')
                setIsLoading(false)
                return
            }

            setSuccess(true)
        } catch (err: any) {
            setError(err.message || 'Network error. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        Forgot Password
                    </CardTitle>
                    <CardDescription>
                        Enter your email address and we'll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="space-y-4">
                            <Alert className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertDescription>
                                    If an account with that email exists, we've sent you an email with instructions to reset your password.
                                </AlertDescription>
                            </Alert>
                            <div className="text-sm text-muted-foreground">
                                Check your spam folder if you don't see it within a few minutes.
                            </div>
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
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="email"
                                                    placeholder="name@example.com"
                                                    autoComplete="email"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Sending link...' : 'Send Reset Link'}
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <div className="text-sm text-muted-foreground text-center">
                        <Link
                            to="/login"
                            className="text-primary underline-offset-4 hover:underline font-medium"
                        >
                            Back to Sign In
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}
