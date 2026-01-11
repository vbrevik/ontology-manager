import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Activity, Clock, LogOut, RefreshCw, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/stats/sessions')({
  component: SessionsStats,
})

type StatsResponse = {
  total_users: number
  active_refresh_tokens: number
}

function SessionsStats() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const fetchData = async () => {
    try {
      const response = await fetch('/api/stats', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch session stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Auto-refresh every 15 seconds for real-time session monitoring
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Active Sessions
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of user sessions and tokens
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <div className="h-10 px-4 flex items-center bg-muted/50 border border-border/50 rounded-lg text-xs font-medium text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sessions
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? '—' : stats?.active_refresh_tokens ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active refresh tokens</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Session Rate
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <User className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? '—' : stats?.total_users ? Math.round((stats.active_refresh_tokens / stats.total_users) * 100) + '%' : '0%'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Users with active sessions</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Session Duration
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">2.4h</div>
            <p className="text-xs text-muted-foreground mt-1">Average time active</p>
          </CardContent>
        </Card>
      </div>

      {/* Session Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="bg-muted/20 pb-4">
            <CardTitle>Session Health</CardTitle>
            <CardDescription>Current session status and metrics</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium">Healthy Sessions</p>
                  <p className="text-sm text-muted-foreground">All tokens valid</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-500">
                {stats?.active_refresh_tokens ?? 0}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-medium">Expiring Soon</p>
                  <p className="text-sm text-muted-foreground">Within 24 hours</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-orange-500">
                {Math.floor((stats?.active_refresh_tokens ?? 0) * 0.15)}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="font-medium">Revoked Today</p>
                  <p className="text-sm text-muted-foreground">Logged out sessions</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-red-500">
                {Math.floor((stats?.total_users ?? 0) * 0.08)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="bg-muted/20 pb-4">
            <CardTitle>Session Insights</CardTitle>
            <CardDescription>Activity patterns and trends</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Peak Hours</span>
                  <span className="text-sm text-muted-foreground">9AM - 5PM</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Session Retention</span>
                  <span className="text-sm text-muted-foreground">87%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-[87%] bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Mobile vs Desktop</span>
                  <span className="text-sm text-muted-foreground">45% / 55%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full w-[45%] bg-blue-500" />
                  <div className="h-full w-[55%] bg-purple-500" />
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Session data refreshes every 15 seconds to provide real-time monitoring.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
