import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertCircle,
    RefreshCw,
    ShieldAlert,
    Clock,
    User,
    LogOut,
    Flame
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import {
    listFirefighterSessions,
    deactivateFirefighter,
    type FirefighterSession
} from "@/features/firefighter/lib/api";

export const Route = createFileRoute('/admin/firefighter')({
    component: FirefighterAudit,
});

function FirefighterAudit() {
    const [sessions, setSessions] = useState<FirefighterSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const data = await listFirefighterSessions();
            setSessions(data);
            setError(null);
        } catch (err) {
            setError("Failed to fetch firefighter sessions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleDeactivate = async (sessionId: string) => {
        try {
            const result = await deactivateFirefighter(sessionId);
            if (result.success) {
                toast({
                    title: "Session Deactivated",
                    description: "The firefighter session has been revoked.",
                });
                fetchSessions();
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.error || "Failed to deactivate session",
                });
            }
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "An unexpected error occurred.",
            });
        }
    };

    const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                        <Flame className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Firefighter Audit</h2>
                        <p className="text-muted-foreground mt-1">Monitor and revoke temporary privileged access sessions.</p>
                    </div>
                </div>
                <Button onClick={fetchSessions} variant="outline" size="sm" className="h-9">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card className="border-border/50 bg-background/50 backdrop-blur-sm shadow-sm">
                <CardHeader>
                    <CardTitle>Session History</CardTitle>
                    <CardDescription>
                        A comprehensive list of all requested break-glass elevations.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Justification</TableHead>
                                <TableHead>Requested At</TableHead>
                                <TableHead>Expires</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="h-8 w-8 animate-spin opacity-20" />
                                            <span>Loading audit logs...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sessions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        No firefighter sessions found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sessions.map((session) => {
                                    const active = !session.deactivated_at && !isExpired(session.expires_at);
                                    return (
                                        <TableRow key={session.id} className="group">
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                                        <User className="w-4 h-4 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{session.user_id.substring(0, 8)}...</span>
                                                        <span className="text-[10px] text-muted-foreground">ID: {session.id.substring(0, 8)}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {active ? (
                                                    <Badge className="bg-orange-500 hover:bg-orange-600 border-none">Active</Badge>
                                                ) : session.deactivated_at ? (
                                                    <Badge variant="secondary">Deactivated</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground">Expired</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-xs">
                                                <p className="text-sm italic truncate" title={session.justification}>
                                                    "{session.justification}"
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(session.activated_at).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                                    {new Date(session.expires_at).toLocaleTimeString()}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {active && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleDeactivate(session.id)}
                                                    >
                                                        <LogOut className="h-4 w-4 mr-2" />
                                                        Revoke
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Alert className="bg-muted/50 border-border/50">
                <ShieldAlert className="h-4 w-4 text-orange-600" />
                <AlertTitle>Security Policy</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                    Firefighter sessions grant global read/write access. All interactions are logged in the
                    <Button variant="link" className="p-0 h-auto text-xs" onClick={() => window.location.href = '/logs'}>system audit logs</Button>
                    with the <code>firefighter.access</code> prefix.
                </AlertDescription>
            </Alert>
        </div>
    );
}
