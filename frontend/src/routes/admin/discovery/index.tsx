import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShieldAlert, Server, Activity, ChevronRight, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAbac } from '@/features/abac/lib/abac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/discovery/')({
    component: ServiceDiscovery,
})

interface ServiceInstance {
    id: String;
    name: string;
    version: string;
    endpoint: string;
    status: 'UP' | 'DOWN' | 'WARNING';
    last_heartbeat: string;
    metadata: Record<string, string>;
}

function ServiceDiscovery() {
    const { hasRole } = useAbac();
    const isAdmin = hasRole('superadmin') || hasRole('admin');
    const [services, setServices] = useState<ServiceInstance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/discovery/services');
            if (response.ok) {
                const data = await response.json();
                setServices(data);
                setError(null);
            } else {
                setError('Failed to fetch services');
            }
        } catch (err) {
            setError('Error connecting to discovery service');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
        const interval = setInterval(fetchServices, 10000);
        return () => clearInterval(interval);
    }, []);

    if (!isAdmin) {
        return (
            <div className="p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to access the Service Discovery dashboard.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'UP': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'DOWN': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'WARNING': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Service Discovery</h2>
                    <p className="text-muted-foreground mt-2">
                        Real-time monitoring of registered services and their health status.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchServices} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>System Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {services.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                        <Server className="h-12 w-12 mx-auto opacity-20 mb-4" />
                        <p>No services registered in the cluster.</p>
                    </div>
                )}

                {services.map((service) => (
                    <Card key={service.id as string} className="overflow-hidden border-border/60 hover:border-primary/30 transition-all hover:shadow-lg group">
                        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-base font-bold truncate max-w-[150px]">
                                            {service.name}
                                        </CardTitle>
                                        <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-mono">
                                            v{service.version}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-xs font-mono truncate">
                                        {service.endpoint}
                                    </CardDescription>
                                </div>
                                <Badge className={`${getStatusColor(service.status)} border rounded-full px-2 py-0 text-[10px] uppercase font-bold`}>
                                    {service.status}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-[11px]">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground font-medium uppercase tracking-wider">Last Heartbeat</p>
                                    <p className="font-mono">{new Date(service.last_heartbeat).toLocaleTimeString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground font-medium uppercase tracking-wider">Service ID</p>
                                    <p className="font-mono truncate" title={service.id as string}>{service.id.slice(0, 8)}...</p>
                                </div>
                            </div>

                            {Object.keys(service.metadata).length > 0 && (
                                <div className="pt-3 border-t border-border/40">
                                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Metadata</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(service.metadata).map(([key, value]) => (
                                            <Badge key={key} variant="secondary" className="text-[9px] px-1.5 py-0 bg-secondary/30">
                                                {key}: {value}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end">
                                <Link
                                    to="/admin/discovery/$serviceId"
                                    params={{ serviceId: service.id as string }}
                                    className="inline-flex items-center justify-center rounded-md text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-7 bg-transparent hover:bg-primary/5 hover:text-primary px-2 gap-1"
                                >
                                    Details <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
