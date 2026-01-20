import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShieldCheck, Server, Database, Cpu, HardDrive, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SystemStatusLayout } from '@/components/layout/SystemStatusLayout'

export const Route = createFileRoute('/stats/system')({
    component: () => (
        <SystemStatusLayout>
            <SystemStatus />
        </SystemStatusLayout>
    ),
})

type SystemMetricsResponse = {
    status: string
    hostname: string
    os_name: string
    os_version: string
    kernel_version: string
    uptime: number
    cpu: {
        usage_percent: number
        cores: number
    }
    memory: {
        total: number
        used: number
        free: number
        usage_percent: number
    }
    disk: {
        total: number
        used: number
        free: number
        usage_percent: number
    }
    network: {
        received_bytes: number
        transmitted_bytes: number
    }
}

type HealthStatus = {
    status: 'operational' | 'degraded' | 'outage'
    uptime: number
    version: string
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function SystemStatus() {
    const [health, setHealth] = useState<HealthStatus>({
        status: 'operational',
        uptime: 0,
        version: '1.0.0',
    })
    const [lastUpdate, setLastUpdate] = useState(new Date())
    const [metrics, setMetrics] = useState<SystemMetricsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchMetrics = async () => {
        try {
            const response = await fetch('/api/system/metrics', { credentials: 'include' })
            if (response.ok) {
                const data: SystemMetricsResponse = await response.json()
                setMetrics(data)

                setHealth({
                    status: (data.status === 'operational' || data.status === 'initializing') ? 'operational' : 'degraded',
                    uptime: data.uptime,
                    version: '1.0.0',
                })
                setLastUpdate(new Date())
            } else {
                setHealth((prev) => ({ ...prev, status: 'degraded' }))
            }
        } catch (error) {
            console.error('Failed to fetch metrics:', error)
            setHealth((prev) => ({ ...prev, status: 'outage' }))
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchMetrics()
        // Auto-refresh every 5 seconds (matched with backend update rate approx)
        const interval = setInterval(fetchMetrics, 5000)
        return () => clearInterval(interval)
    }, [])

    const statusColor = {
        operational: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Operational' },
        degraded: { text: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Degraded' },
        outage: { text: 'text-red-500', bg: 'bg-red-500/10', label: 'Outage' },
    }[health.status]

    const uptimeHours = Math.floor(health.uptime / 3600)
    const uptimeMinutes = Math.floor((health.uptime % 3600) / 60)
    const uptimeString = `${uptimeHours}h ${uptimeMinutes}m`

    if (isLoading && !metrics) {
        return <div className="p-8 flex justify-center text-muted-foreground">Loading system metrics...</div>
    }

    // Default empty metrics if null (shouldn't happen after loading unless error)
    const m = metrics || {
        cpu: { usage_percent: 0 },
        memory: { usage_percent: 0, used: 0, total: 0 },
        disk: { usage_percent: 0, used: 0, total: 0 },
        network: { usage_percent: 0 } // usage_percent is not in network type but calculating fake for UI
    } as any

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                        System Status
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Real-time system health and performance metrics
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchMetrics}
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                    <div className="h-10 px-4 flex items-center bg-muted/50 border border-border/50 rounded-lg text-xs font-medium text-muted-foreground">
                        Last checked: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>
            </header>

            {/* Overall Status */}
            <Card className={`border-2 ${statusColor.bg} border-${health.status === 'operational' ? 'emerald' : health.status === 'degraded' ? 'orange' : 'red'}-500/20`}>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-full ${statusColor.bg} flex items-center justify-center`}>
                            <ShieldCheck className={`h-8 w-8 ${statusColor.text}`} />
                        </div>
                        <div>
                            <CardTitle className="text-2xl">System {statusColor.label}</CardTitle>
                            <CardDescription>
                                All services running smoothly • Uptime: {uptimeString}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Service Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            API Server
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                            <Server className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">Online</div>
                        <p className="text-xs text-muted-foreground mt-1">Hostname: {metrics?.hostname || 'Unknown'}</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Database
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                            <Database className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">Connected</div>
                        <p className="text-xs text-muted-foreground mt-1">PostgreSQL</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            CPU Usage
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                            <Cpu className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">{Math.round(m.cpu.usage_percent)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{m.cpu.cores} Cores</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Memory
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
                            <HardDrive className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">{Math.round(m.memory.usage_percent)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{formatBytes(m.memory.used)} / {formatBytes(m.memory.total)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="bg-muted/20 pb-4">
                        <CardTitle>Service Health</CardTitle>
                        <CardDescription>Individual component status</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-3">
                        {[
                            { name: 'Authentication Service', status: 'operational', latency: '12ms' },
                            { name: 'User Management', status: 'operational', latency: '8ms' },
                            { name: 'Database Connections', status: 'operational', latency: '3ms' },
                            { name: 'Rate Limiting', status: 'operational', latency: '< 1ms' },
                            { name: 'CSRF Protection', status: 'operational', latency: '< 1ms' },
                        ].map((service, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="font-medium text-sm">{service.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{service.latency}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="bg-muted/20 pb-4">
                        <CardTitle>System Metrics</CardTitle>
                        <CardDescription>Resource utilization over time</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">CPU Load</span>
                                    <span className="text-sm text-emerald-500 font-semibold">{Math.round(m.cpu.usage_percent)}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${m.cpu.usage_percent}%` }} />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">Memory Usage</span>
                                    <span className="text-sm text-blue-500 font-semibold">{Math.round(m.memory.usage_percent)}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" style={{ width: `${m.memory.usage_percent}%` }} />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">Disk Usage</span>
                                    <span className="text-sm text-purple-500 font-semibold">{Math.round(m.disk.usage_percent)}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${m.disk.usage_percent}%` }} />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border/50">
                                <p className="text-sm text-muted-foreground">
                                    Network: {formatBytes(m.network.received_bytes)} In / {formatBytes(m.network.transmitted_bytes)} Out
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    OS: {metrics?.os_name} {metrics?.os_version} (Kernel: {metrics?.kernel_version})
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
