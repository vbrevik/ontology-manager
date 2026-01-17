
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2, Copy, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/context'
import { setupMfa, verifyMfaSetup, disableMfa, regenerateBackupCodes, getMfaStatus, type MfaSetupResponse } from '../lib/mfa'

export function MfaSetup() {
    const { user } = useAuth()
    const [step, setStep] = useState<'IDLE' | 'SETUP' | 'VERIFY' | 'SUCCESS'>('IDLE')
    const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null)
    const [verifyCode, setVerifyCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [backupCodes, setBackupCodes] = useState<string[]>([])

    // Need to know if MFA is already enabled
    // We can fetch status
    const [isEnabled, setIsEnabled] = useState(false) // This should be fetched

    // Simple fetch on mount
    useState(() => {
        if (user) {
            getMfaStatus(user.id).then(status => {
                if (status) setIsEnabled(status.enabled)
            })
        }
    })

    const handleStartSetup = async () => {
        setError(null)
        try {
            if (!user) return
            const data = await setupMfa(user.id, user.email)
            setSetupData(data)
            setStep('SETUP')
        } catch (err: any) {
            setError(err.message)
        }
    }

    const handleVerify = async () => {
        setError(null)
        try {
            if (!user) return
            await verifyMfaSetup(user.id, verifyCode)
            // Success! Fetch backup codes
            const codes = await regenerateBackupCodes(user.id)
            setBackupCodes(codes)
            setIsEnabled(true)
            setStep('SUCCESS')
        } catch (err: any) {
            setError(err.message)
        }
    }

    const handleDisable = async () => {
        if (!confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) return
        try {
            if (!user) return
            await disableMfa(user.id)
            setIsEnabled(false)
            setStep('IDLE')
        } catch (err: any) {
            setError(err.message)
        }
    }

    if (step === 'SUCCESS') {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-6 w-6" />
                        <CardTitle>MFA Enabled Successfully</CardTitle>
                    </div>
                    <CardDescription>
                        Two-factor authentication is now protecting your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <ShieldCheck className="h-4 w-4" />
                        <AlertTitle>Backup Codes</AlertTitle>
                        <AlertDescription>
                            Store these recovery codes in a safe place. They are the only way to access your account if you lose your device.
                        </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-md font-mono text-sm">
                        {backupCodes.map((code, i) => (
                            <div key={i} className="text-center select-all">{code}</div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={() => setStep('IDLE')} className="w-full">Done</Button>
                </CardFooter>
            </Card>
        )
    }

    if (isEnabled && step === 'IDLE') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                        Two-Factor Authentication is Enabled
                    </CardTitle>
                    <CardDescription>
                        Your account is secured with 2FA.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">
                        You will be asked to enter a code from your authenticator app when you log in.
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={async () => {
                        if (!user) return;
                        const codes = await regenerateBackupCodes(user.id);
                        setBackupCodes(codes);
                        setStep('SUCCESS'); // Reuse success view to show codes
                    }}>
                        View Backup Codes
                    </Button>
                    <Button variant="destructive" onClick={handleDisable}>
                        Disable 2FA
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
                <CardDescription>
                    Add an extra layer of security to your account by requiring a code from your authenticator app.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {step === 'IDLE' && (
                    <div className="flex flex-col gap-4">
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
                            ⚠️ Your account is currently not protected by 2FA.
                        </div>
                        <Button onClick={handleStartSetup}>Enable 2FA</Button>
                    </div>
                )}

                {step === 'SETUP' && setupData && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label>1. Scan QR Code</Label>
                            <div className="flex justify-center p-4 border rounded-md bg-white">
                                <img src={setupData.qr_code} alt="MFA QR Code" className="w-48 h-48" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Or enter code manually</Label>
                            <div className="flex items-center gap-2">
                                <Input readOnly value={setupData.secret} className="font-mono" />
                                <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(setupData.secret)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>2. Verify Code</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={verifyCode}
                                    onChange={e => setVerifyCode(e.target.value)}
                                    placeholder="Enter 6-digit code"
                                    maxLength={6}
                                />
                                <Button onClick={handleVerify}>Verify</Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
            {step === 'SETUP' && (
                <CardFooter>
                    <Button variant="ghost" onClick={() => setStep('IDLE')}>Cancel</Button>
                </CardFooter>
            )}
        </Card>
    )
}
