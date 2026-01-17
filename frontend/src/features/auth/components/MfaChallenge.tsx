
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { AlertCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { verifyMfaLogin } from '../lib/mfa'
import { useAuth } from '../lib/context'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const mfaSchema = z.object({
    code: z.string().min(6, 'Code must be 6 characters').max(6).regex(/^\d+$/, 'Must be numbers'),
})

type MfaFormValues = z.infer<typeof mfaSchema>

interface MfaChallengeProps {
    userId: string;
    rememberMe: boolean;
    onSuccess: () => void;
    onCancel: () => void;
}

export function MfaChallenge({ userId, rememberMe, onSuccess, onCancel }: MfaChallengeProps) {
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const { refreshAuth } = useAuth() // To update auth state after successful verification

    const form = useForm<MfaFormValues>({
        resolver: zodResolver(mfaSchema),
        defaultValues: {
            code: '',
        },
    })

    const onSubmit = async (values: MfaFormValues) => {
        setIsLoading(true)
        setError(null)

        try {
            await verifyMfaLogin(userId, values.code, rememberMe)
            // verifyMfaLogin returns AuthResponse (with tokens)
            // The tokens are set in HttpOnly cookies by the backend handler

            // Update context state
            await refreshAuth()

            onSuccess()
        } catch (err: any) {
            setError(err.message || 'Invalid code. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-center">
                    Two-Factor Authentication
                </CardTitle>
                <CardDescription className="text-center">
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
                                    <FormLabel className="sr-only">Authentication Code</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="000000"
                                            className="text-center text-lg tracking-widest"
                                            maxLength={6}
                                            autoComplete="one-time-code"
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

                        <Button variant="ghost" type="button" className="w-full" onClick={onCancel}>
                            Cancel
                        </Button>
                    </form>
                </Form>
            </CardContent>
            <CardFooter className="flex justify-center">
                <p className="text-sm text-muted-foreground text-center">
                    Lost your device? <span className="font-medium text-primary cursor-pointer hover:underline">Use a recovery code</span>
                </p>
            </CardFooter>
        </Card>
    )
}
