import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, Activity, ShieldCheck, Zap, Server, Cpu, HardDrive, Network, BrainCircuit, Terminal, AlertCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type StatsResponse = {
  total_users: number
  active_refresh_tokens: number
}

type ActivityEntry = {
  id: string
  username: string
  email: string
  created_at: string
}

type SystemMetrics = {
  status: string
  hostname: string
  os_name: string
  os_version: string
  kernel_version: string
  uptime: number
  cpu: {
    usage_percent: number
    cores: number
    load_avg: { one: number; five: number; fifteen: number }
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

type AiStatus = {
  status: string
  model?: string
  provider_url?: string
  message?: string
}

type AuditLog = {
  id: string
  action: string
  target_type: string
  created_at: string
  actor_username?: string // inferred strictly for UI if joined, otherwise we just show action
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        const [statsRes, activityRes, metricsRes, logsRes, aiRes] = await Promise.all([
          fetch('/api/stats', { credentials: 'include' }),
          fetch('/api/activity', { credentials: 'include' }),
          fetch('/api/system/metrics', { credentials: 'include' }),
          fetch('/api/system/logs', { credentials: 'include' }),
          fetch('/api/ai/status', { credentials: 'include' }), // POST or GET? backend says post(get_status).get(get_status) so fetch GET works
        ])

        if (!statsRes.ok && statsRes.status !== 404) console.warn('Stats fetch failed')
        if (!activityRes.ok && activityRes.status !== 404) console.warn('Activity fetch failed')
        if (!metricsRes.ok && metricsRes.status !== 404) console.warn('Metrics fetch failed')
        if (!logsRes.ok && logsRes.status !== 404) console.warn('Logs fetch failed')
        if (!aiRes.ok && aiRes.status !== 404) console.warn('AI Status fetch failed')

        // Helper to safely extract JSON
        const safeJson = async (res: Response) => {
          if (res.ok) return await res.json()
          return null
        }

        const statsJson = await safeJson(statsRes)
        const activityJson = await safeJson(activityRes)
        const metricsJson = await safeJson(metricsRes)
        const logsJson = await safeJson(logsRes)
        const aiJson = await safeJson(aiRes)

        if (!mounted) return

        if (statsJson) setStats(statsJson)
        if (activityJson) setActivity(activityJson)
        if (metricsJson) setMetrics(metricsJson)
        if (logsJson) setLogs(logsJson) // Logs might be empty array
        if (aiJson) setAiStatus(aiJson)

      } catch (err: any) {
        if (!mounted) return
        console.error("Dashboard fetch error:", err)
        setError(err.message || 'Partial data load user')
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    }

    fetchData()
    // Poll for metrics every 30 seconds
    const interval = setInterval(fetchData, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / (3600 * 24))
    const h = Math.floor((seconds % (3600 * 24)) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${d}d ${h}h ${m}m`
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary/40" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing Command Center...</p>
        </div>
      </div>
    )
  }

  // Fallback for stats if null
  const totalUsers = stats?.total_users ?? 0
  const activeSessions = stats?.active_refresh_tokens ?? 0

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            System Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring and orchestration dashboard.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <div className="hidden md:flex items-center gap-2 text-amber-500 text-xs font-medium animate-pulse bg-amber-500/10 px-2 py-1 rounded">
              <AlertCircle size={14} />
              <span>Partial Synchronization</span>
            </div>
          )}
          <Badge variant="outline" className="h-8 gap-1.5 px-3 font-normal">
            <div className={`w-2 h-2 rounded-full ${metrics?.status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
            System {metrics?.status === 'operational' ? 'Optimal' : (metrics?.status || 'Checking')}
          </Badge>
          <div className="h-8 px-3 flex items-center bg-muted/50 border border-border/50 rounded-md text-xs font-mono text-muted-foreground">
            {metrics?.hostname || 'Host'}
          </div>
        </div>
      </header>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users */}
        <Card className="border-border/60 shadow-sm hover:border-primary/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Users size={20} />
            </div>
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card className="border-border/60 shadow-sm hover:border-primary/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Active Sessions</p>
              <div className="text-2xl font-bold">{activeSessions}</div>
            </div>
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Activity size={20} />
            </div>
          </CardContent>
        </Card>

        {/* AI Status */}
        <Card className="border-border/60 shadow-sm hover:border-primary/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">AI Neural Status</p>
              <div className="text-2xl font-bold capitalize flex items-center gap-2">
                {aiStatus?.status || 'Unknown'}
              </div>
            </div>
            <div className={`p-3 rounded-xl ${aiStatus?.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
              <BrainCircuit size={20} />
            </div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card className="border-border/60 shadow-sm hover:border-primary/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">System Uptime</p>
              <div className="text-2xl font-bold">{formatUptime(metrics?.uptime || 0)}</div>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <Server size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main Column: System Health & Logs */}
        <div className="lg:col-span-2 space-y-8">

          {/* System Health */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Resource Monitoring
              </CardTitle>
              <CardDescription>
                {metrics?.hostname} • {metrics?.os_name} {metrics?.os_version}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* CPU */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Cpu size={14} /> CPU Load ({metrics?.cpu.cores} Cores)
                  </span>
                  <span className="font-bold">{metrics?.cpu.usage_percent.toFixed(1)}%</span>
                </div>
                <Progress value={metrics?.cpu.usage_percent} className="h-2" />
              </div>

              {/* Memory */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <HardDrive size={14} /> Memory ({formatBytes(metrics?.memory.used || 0)} / {formatBytes(metrics?.memory.total || 0)})
                  </span>
                  <span className="font-bold">{metrics?.memory.usage_percent.toFixed(1)}%</span>
                </div>
                <Progress value={metrics?.memory.usage_percent} className="h-2" />
              </div>

              {/* Disk */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Server size={14} /> Storage ({formatBytes(metrics?.disk.used || 0)} / {formatBytes(metrics?.disk.total || 0)})
                  </span>
                  <span className="font-bold">{metrics?.disk.usage_percent.toFixed(1)}%</span>
                </div>
                <Progress value={metrics?.disk.usage_percent} className="h-2" />
              </div>

              {/* Network */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Network size={12} className="rotate-180" /> Inbound
                  </div>
                  <div className="text-lg font-bold">{formatBytes(metrics?.network.received_bytes || 0)}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Network size={12} /> Outbound
                  </div>
                  <div className="text-lg font-bold">{formatBytes(metrics?.network.transmitted_bytes || 0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Logs */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  System Logs
                </CardTitle>
                <CardDescription>Recent audit events and system actions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/logs" className="text-xs">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border/50 bg-muted/30">
                {logs && logs.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {logs.slice(0, 5).map((log) => (
                      <div key={log.id} className="p-3 flex items-start justify-between text-sm hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col gap-1">
                          <div className="font-medium flex items-center gap-2">
                            <span className="text-primary">{log.action}</span>
                            <span className="text-muted-foreground text-xs">on</span>
                            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border">{log.target_type}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.id.substring(0, 8)}...
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No logs available locally.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: AI & Quick Actions */}
        <div className="space-y-6">

          {/* AI Control Panel */}
          <Card className="border-border/60 shadow-sm overflow-hidden bg-gradient-to-b from-background to-muted/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                AI Orchestration
              </CardTitle>
              <CardDescription>
                Active Model Configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium truncate max-w-[150px]" title={aiStatus?.provider_url}>
                    {aiStatus?.provider_url ? (aiStatus.provider_url.includes('localhost') ? 'Ollama (Local)' : aiStatus.provider_url) : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium truncate max-w-[150px]" title={aiStatus?.model}>
                    {aiStatus?.model || 'None'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Service Level</span>
                  <Badge variant="outline" className={`border-${aiStatus?.status === 'Healthy' ? 'emerald' : 'amber'}-500/20 bg-${aiStatus?.status === 'Healthy' ? 'emerald' : 'amber'}-500/10 text-${aiStatus?.status === 'Healthy' ? 'emerald' : 'amber'}-500`}>
                    {aiStatus?.status || 'Unknown'}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" asChild>
                <Link to="/admin/ai">Configure Models</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Users */}
          <Card className="border-border/60 shadow-sm flex-1">
            <CardHeader>
              <CardTitle className="text-base">Recent Users</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {activity.slice(0, 5).map((user) => (
                  <div key={user.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {user.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.username}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {activity.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No recent activity
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border/50">
                <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                  <Link to="/stats/users">View All Users</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
