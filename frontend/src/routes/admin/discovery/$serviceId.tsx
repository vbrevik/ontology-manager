import { createFileRoute, useParams, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShieldAlert, Server, Activity, ChevronLeft, RefreshCw, Clock, Globe, Shield } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAbac } from '@/features/abac/lib/abac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/discovery/$serviceId')({
    component: ServiceDetails,
})

interface ServiceInstance {
    id: string;
    name: string;
    version: string;
    endpoint: string;
    status: 'UP' | 'DOWN' | 'WARNING';
    last_heartbeat: string;
    metadata: Record<string, string>;
    entity_id?: string;
}

function ServiceDetails() {
    const { serviceId } = useParams({ from: '/admin/discovery/$serviceId' });
    const { hasRole } = useAbac();
    const isAdmin = hasRole('superadmin') || hasRole('admin');

    const [service, setService] = useState<ServiceInstance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchService = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/discovery/services/${serviceId}`);
            if (response.ok) {
                const data = await response.json();
                setService(data);
                setError(null);
            } else {
                setError('Service not found or failed to fetch');
            }
        } catch (err) {
            setError('Error connecting to discovery service');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchService();
        const interval = setInterval(fetchService, 10000);
        return () => clearInterval(interval);
    }, [serviceId]);

    if (!isAdmin) {
        return (
            <div className="p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to access service details.
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

    if (loading && !service) {
        return <div className="p-8 text-center text-muted-foreground">Loading service details...</div>;
    }

    if (error || !service) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-4">
                <Link to="/admin/discovery" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" /> Back to Discovery
                </Link>
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error || 'Service not found'}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col gap-4">
                <Link to="/admin/discovery" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                </Link>

                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold tracking-tight">{service.name}</h2>
                            <Badge className={`${getStatusColor(service.status)} border rounded-full px-3 py-0.5 text-xs uppercase font-bold`}>
                                {service.status}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground font-mono text-sm underline group">
                            {service.endpoint}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Button variant="outline" size="sm" onClick={fetchService} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        {service.entity_id && (
                            <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-indigo-600" asChild>
                                <a href={`/admin/ontology/Explorer?entityId=${service.entity_id}`}>View in Entity Explorer</a>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Section */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Deployment Summary</CardTitle>
                        <CardDescription>Version and infrastructure information</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-8 py-6">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Version</p>
                                <p className="text-xl font-bold font-mono">v{service.version}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Uptime (Last Heartbeat)</p>
                                <p className="text-sm font-medium">{new Date(service.last_heartbeat).toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground">Updated every 10s</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                <Globe className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Endpoint Host</p>
                                <p className="text-sm font-medium truncate max-w-[150px]">{new URL(service.endpoint).hostname}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Service ID</p>
                                <p className="text-[10px] font-mono break-all">{service.id}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Metadata Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Metadata</CardTitle>
                        <CardDescription>Custom key-value pairs</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {Object.keys(service.metadata).length === 0 ? (
                            <p className="text-sm text-center text-muted-foreground py-8 italic">No metadata available</p>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(service.metadata).map(([key, value]) => (
                                    <div key={key} className="p-3 bg-muted/40 rounded-lg border border-border/40">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">{key}</p>
                                        <p className="text-sm font-mono text-primary">{value}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Health Logs Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Health History</CardTitle>
                    <CardDescription>Recent status checks and response times</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg mx-6 mb-6">
                    <Server className="h-8 w-8 opacity-20 mb-2" />
                    <p className="text-sm italic">Historical metrics collection pending next update.</p>
                </CardContent>
            </Card>
        </div>
    );
}
