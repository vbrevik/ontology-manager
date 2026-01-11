import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, Key, Shield, User, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DebugAuthResponse {
    raw_token: string;
    claims: any;
    db_roles: any[];
}

export function DebugPage() {
    const [data, setData] = useState<DebugAuthResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchDebug() {
            try {
                const response = await fetch('/api/auth/debug', {
                    method: 'GET',
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch debug info: ${response.statusText}`);
                }

                const debugData = await response.json();
                setData(debugData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchDebug();
    }, []);

    if (loading) {
        return <div className="p-8 flex items-center justify-center">Loading debug info...</div>;
    }

    if (error) {
        return (
            <div className="p-8">
                <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Debug Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Terminal className="text-blue-500" /> System Debug
                </h2>
                <p className="text-muted-foreground mt-2">
                    Inspect your current session, JWT claims, and database role assignments.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-border/60">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Key className="h-5 w-5 text-amber-500" /> Raw Access Token
                        </CardTitle>
                        <CardDescription>The actual JWT string stored in your cookies</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-muted p-4 rounded-lg overflow-x-auto">
                            <code className="text-[10px] break-all text-muted-foreground whitespace-pre-wrap">
                                {data?.raw_token}
                            </code>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <Badge variant="outline" className="text-xs">RS256</Badge>
                            <Badge variant="outline" className="text-xs">HttpOnly Cookie</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5 text-indigo-500" /> Decoded Claims
                        </CardTitle>
                        <CardDescription>The payload stored inside your JWT</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs text-blue-400 dark:text-blue-300">
                            {JSON.stringify(data?.claims, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-green-500" /> Database Role Assignments
                    </CardTitle>
                    <CardDescription>Live data fetched directly from the user_roles table</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data?.db_roles && data.db_roles.length > 0 ? (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Role</th>
                                            <th className="px-4 py-2 text-left">Resource / Scope</th>
                                            <th className="px-4 py-2 text-left">Assigned At</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {data.db_roles.map((a: any) => (
                                            <tr key={a.id}>
                                                <td className="px-4 py-3">
                                                    <Badge variant="secondary" className="font-mono">{a.role_name}</Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {a.resource_name ? (
                                                        <span className="text-muted-foreground italic">{a.resource_name}</span>
                                                    ) : (
                                                        <Badge variant="outline">Global</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                                                    {a.created_at || 'Recently added'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-muted-foreground italic text-center py-8">No roles assigned in the database.</p>
                        )}

                        <Alert className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                            <Info className="h-4 w-4 text-blue-500" />
                            <AlertTitle>Token Comparison</AlertTitle>
                            <AlertDescription className="text-xs">
                                The **Decoded Claims** show what your current session "believes". The **Database Roles** show what the server currently has on file. If they differ, you must logout and login to refresh your token.
                            </AlertDescription>
                        </Alert>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
