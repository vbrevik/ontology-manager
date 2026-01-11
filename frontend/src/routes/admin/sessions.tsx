import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Laptop, Smartphone, Globe, Trash2, RefreshCw, LogOut } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import {
    type AdminSessionResponse,
    listAllSessions,
    revokeAdminSession
} from "@/features/auth/lib/auth"

export const Route = createFileRoute('/admin/sessions')({
    component: AdminSessions,
})

function timeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function AdminSessions() {
    const [sessions, setSessions] = useState<AdminSessionResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()

    const fetchSessions = async () => {
        setLoading(true)
        try {
            const data = await listAllSessions()
            setSessions(data)
            setError(null)
        } catch (err) {
            setError("Failed to fetch sessions")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSessions()
    }, [])

    const [sessionToRevoke, setSessionToRevoke] = useState<AdminSessionResponse | null>(null)

    const handleRevokeClick = (session: AdminSessionResponse) => {
        setSessionToRevoke(session)
    }

    const confirmRevoke = async () => {
        if (!sessionToRevoke) return

        try {
            const result = await revokeAdminSession(sessionToRevoke.id)
            if (result.success) {
                toast({
                    title: "Session Revoked",
                    description: "The session has been successfully terminated.",
                })
                fetchSessions()
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.error || "Failed to revoke session",
                })
            }
            setSessionToRevoke(null)
        } catch (err) {
            console.error('Failed to revoke session:', err)
            toast({
                variant: "destructive",
                title: "Error",
                description: "An unexpected error occurred while revoking the session.",
            })
            setSessionToRevoke(null)
        }
    }

    const getDeviceIcon = (ua: string | null) => {
        if (!ua) return <Globe className="h-4 w-4" />
        if (ua.toLowerCase().includes("mobile")) return <Smartphone className="h-4 w-4" />
        return <Laptop className="h-4 w-4" />
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Session Management</h2>
                    <p className="text-muted-foreground mt-1">Monitor and manage active user sessions across the system.</p>
                </div>
                <Button onClick={fetchSessions} variant="outline" size="sm">
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

            <Card>
                <CardHeader>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>
                        List of all currently active refresh tokens. Revoking a token will force the user to log in again.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Device / IP</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Expires</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Loading sessions...
                                    </TableCell>
                                </TableRow>
                            ) : sessions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No active sessions found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sessions.map((session) => (
                                    <TableRow key={session.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{session.username}</span>
                                                <span className="text-xs text-muted-foreground">{session.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                    {getDeviceIcon(session.user_agent)}
                                                    <span className="truncate max-w-[200px]" title={session.user_agent || ''}>
                                                        {session.ip_address || 'Unknown IP'}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                                    {session.user_agent || 'Unknown UA'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {timeAgo(session.created_at)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                Expires {timeAgo(session.expires_at).replace("ago", "")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleRevokeClick(session)}
                                                title="Revoke Session"
                                            >
                                                <LogOut className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AlertDialog open={!!sessionToRevoke} onOpenChange={(open) => !open && setSessionToRevoke(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Session?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to revoke the session for <strong>{sessionToRevoke?.user_agent}</strong>? The user will be immediately logged out.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRevoke} className="bg-red-600 hover:bg-red-700">Revoke Session</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )

}
