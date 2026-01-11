import { useState, useEffect } from 'react';
import { Clock, Activity, AlertCircle } from 'lucide-react';

type AuditLog = {
    id: string;
    user_id: string;
    action: string;
    entity_id: string | null;
    meta_data: any;
    created_at: string;
}

export function UserActivityLog({ userId }: { userId: string }) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // Assuming there's an endpoint to fetch logs for a specific user
                // If not, we might need to filter system logs or create this endpoint
                const res = await fetch(`/api/system/audit?user_id=${userId}`, { credentials: 'include' });
                if (!res.ok) throw new Error('Failed to fetch activity logs');
                const data = await res.json();
                setLogs(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [userId]);

    if (loading) return <div className="p-4 text-center text-xs text-muted-foreground">Loading activity...</div>;
    if (error) return (
        <div className="p-4 text-center text-xs text-destructive flex flex-col items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Recent Activity</h3>
            </div>

            {logs.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded border border-dashed text-center">
                    No recent activity found.
                </div>
            ) : (
                <div className="space-y-2">
                    {logs.map(log => (
                        <div key={log.id} className="flex gap-3 p-2 rounded border bg-card text-sm">
                            <div className="mt-0.5">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-start">
                                    <span className="font-medium text-xs font-mono">{log.action}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {new Date(log.created_at).toLocaleString()}
                                    </span>
                                </div>
                                {log.meta_data && (
                                    <pre className="text-[10px] bg-muted/50 p-1.5 rounded font-mono overflow-hidden truncate max-w-full">
                                        {JSON.stringify(log.meta_data)}
                                    </pre>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
