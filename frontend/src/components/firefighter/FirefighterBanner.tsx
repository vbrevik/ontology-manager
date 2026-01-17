import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Flame, X, Clock } from "lucide-react";
import { getFirefighterStatus, deactivateFirefighter, type FirefighterStatus } from "@/features/firefighter/lib/api";
import { useToast } from "@/components/ui/use-toast";

export function FirefighterBanner() {
    const [status, setStatus] = useState<FirefighterStatus | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const { toast } = useToast();

    const fetchStatus = async () => {
        const data = await getFirefighterStatus();
        setStatus(data);
    };

    useEffect(() => {
        fetchStatus();
        // Refresh status every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!status?.is_active || !status.session?.expires_at) {
            setTimeLeft("");
            return;
        }

        const tick = () => {
            const now = new Date();
            const expires = new Date(status.session!.expires_at);
            const diff = expires.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("Expired");
                fetchStatus(); // Refresh to clear banner
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${mins}m ${secs}s`);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [status]);

    const handleDeactivate = async () => {
        const result = await deactivateFirefighter("Manual deactivation");
        if (result.success) {
            toast({
                title: "Firefighter Mode Deactivated",
                description: "Your permissions have returned to normal."
            });
            fetchStatus();
        }
    };

    if (!status?.is_active) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xl px-4 animate-in slide-in-from-bottom-4">
            <Alert className="border-orange-500 bg-orange-50 text-orange-950 shadow-lg">
                <Flame className="h-4 w-4 text-orange-600" />
                <AlertTitle className="flex items-center justify-between font-bold text-orange-900">
                    <span>Firefighter Mode Active</span>
                    <div className="flex items-center gap-1 text-sm font-medium bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                        <Clock className="w-3 h-3" />
                        {timeLeft}
                    </div>
                </AlertTitle>
                <AlertDescription className="mt-2 flex items-center justify-between gap-4">
                    <span className="text-sm opacity-90">
                        You have elevated access. Justification: "{status.session?.justification}"
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDeactivate}
                        className="bg-white border-orange-200 hover:bg-orange-100 text-orange-700 py-0 h-8 text-xs shrink-0"
                    >
                        <X className="w-3 h-3 mr-1" />
                        End Session
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    );
}
