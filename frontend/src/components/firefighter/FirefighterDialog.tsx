import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { requestElevation } from "@/features/firefighter/lib/api";
import { Flame } from "lucide-react";

interface FirefighterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onActivated: () => void;
}

export function FirefighterDialog({ open, onOpenChange, onActivated }: FirefighterDialogProps) {
    const [password, setPassword] = useState("");
    const [justification, setJustification] = useState("");
    const [duration, setDuration] = useState("60");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    async function handleActivate() {
        if (!password || !justification) return;

        setLoading(true);
        setError(null);
        try {
            const result = await requestElevation(
                password,
                justification,
                parseInt(duration)
            );

            if (result.success) {
                toast({
                    title: "Firefighter Mode Activated",
                    description: "You now have elevated permissions for the next " + duration + " minutes.",
                    variant: "default",
                });
                onActivated();
                onOpenChange(false);
                // Clear state
                setPassword("");
                setJustification("");
            } else {
                setError(result.error || "Activation failed");
                toast({
                    variant: "destructive",
                    title: "Activation Failed",
                    description: result.error || "Check your password and try again."
                });
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                            <Flame className="w-5 h-5" />
                        </div>
                        <DialogTitle>Activate Firefighter Mode</DialogTitle>
                    </div>
                    <DialogDescription>
                        This will temporarily elevate your access to Superadmin level.
                        <strong> All actions performed in this mode are strictly audited.</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="password">Confirm Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            placeholder="To verify your identity"
                            autoComplete="current-password"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="justification">Justification</Label>
                        <Textarea
                            id="justification"
                            value={justification}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJustification(e.target.value)}
                            placeholder="Why do you need elevated access?"
                            rows={3}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="duration">Duration</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select duration..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="15">15 Minutes</SelectItem>
                                <SelectItem value="30">30 Minutes</SelectItem>
                                <SelectItem value="60">1 Hour</SelectItem>
                                <SelectItem value="120">2 Hours</SelectItem>
                                <SelectItem value="240">4 Hours</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {error && (
                        <div className="p-2 rounded bg-destructive/10 text-destructive text-sm border border-destructive/20">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleActivate}
                        disabled={!password || !justification || loading}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        {loading ? "Activating..." : "Activate Mode"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
