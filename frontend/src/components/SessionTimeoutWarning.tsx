import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Clock, LogOut } from 'lucide-react'

interface SessionTimeoutWarningProps {
    open: boolean
    timeRemaining: number // in seconds
    onExtend: () => void
    onLogout: () => void
}

export function SessionTimeoutWarning({
    open,
    timeRemaining,
    onExtend,
    onLogout
}: SessionTimeoutWarningProps) {
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60

    return (
        <AlertDialog open={open}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-amber-500" />
                        </div>
                        <AlertDialogTitle className="text-xl">Session Expiring Soon</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-base pt-2">
                        Your session will expire due to inactivity. You will be automatically logged out in:
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-6 flex justify-center">
                    <div className="text-center">
                        <div className="text-5xl font-bold font-mono tabular-nums text-foreground">
                            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">minutes remaining</p>
                    </div>
                </div>

                <AlertDialogFooter className="flex gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={onLogout}
                        className="flex items-center gap-2"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout Now
                    </Button>
                    <Button
                        onClick={onExtend}
                        className="flex items-center gap-2 bg-primary"
                    >
                        <Clock className="h-4 w-4" />
                        Extend Session
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
