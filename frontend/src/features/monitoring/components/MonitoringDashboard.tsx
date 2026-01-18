import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  Activity,
  Users,
  Shield,
  TrendingUp,
  Clock,
  Eye,
  BarChart3,
} from 'lucide-react'
import { EventTimeline } from './EventTimeline'
import { EventDistributionChart } from './EventDistributionChart'
import { HourlyTrendChart } from './HourlyTrendChart'
import { TopAttackingIPs } from './TopAttackingIPs'
import { UserActivityTable } from './UserActivityTable'
import { AnomaliesPanel } from './AnomaliesPanel'
import { SeverityBreakdown } from './SeverityBreakdown'

interface DashboardStats {
  total_events_24h: number
  critical_events_24h: number
  failed_auth_24h: number
  unique_users_24h: number
  unique_ips_24h: number
  top_event_type: string
  avg_api_response_time_ms: number | null
  active_alerts: number
}

export function MonitoringDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/analytics/dashboard', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch dashboard stats')
      return response.json() as Promise<DashboardStats>
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  if (statsLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-muted-foreground">Loading monitoring dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and analytics dashboard
          </p>
        </div>
        <Badge variant={stats.critical_events_24h > 0 ? 'destructive' : 'success'}>
          {stats.critical_events_24h > 0 ? 'CRITICAL ALERTS' : 'ALL CLEAR'}
        </Badge>
      </div>

      {/* Active Alerts Banner */}
      {stats.active_alerts > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Security Alerts</AlertTitle>
          <AlertDescription>
            {stats.active_alerts} unresolved security event(s) requiring attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_events_24h.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Top: {stats.top_event_type}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.critical_events_24h}
            </div>
            <p className="text-xs text-muted-foreground">
              Requiring immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Auth</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed_auth_24h}</div>
            <p className="text-xs text-muted-foreground">
              {stats.unique_ips_24h} unique IPs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unique_users_24h}</div>
            <p className="text-xs text-muted-foreground">
              {stats.avg_api_response_time_ms
                ? `Avg response: ${Math.round(stats.avg_api_response_time_ms)}ms`
                : 'No API data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="w-4 h-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="threats">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Threats
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Event Distribution</CardTitle>
                <CardDescription>Event types in last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <EventDistributionChart hours={24} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Severity Breakdown</CardTitle>
                <CardDescription>Events by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <SeverityBreakdown hours={24} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Hourly Event Trends</CardTitle>
              <CardDescription>Event volume over the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <HourlyTrendChart hours={24} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <EventTimeline />
        </TabsContent>

        {/* Threats Tab */}
        <TabsContent value="threats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Attacking IPs</CardTitle>
                <CardDescription>Most suspicious IP addresses</CardDescription>
              </CardHeader>
              <CardContent>
                <TopAttackingIPs limit={10} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detected Anomalies</CardTitle>
                <CardDescription>Unusual patterns and behaviors</CardDescription>
              </CardHeader>
              <CardContent>
                <AnomaliesPanel hours={24} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
              <CardDescription>User-level security event summary</CardDescription>
            </CardHeader>
            <CardContent>
              <UserActivityTable limit={50} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Failed Auth Trend</CardTitle>
                <CardDescription>Failed authentication attempts over time</CardDescription>
              </CardHeader>
              <CardContent>
                <HourlyTrendChart 
                  hours={24} 
                  eventClass="FailedAuthAttempt" 
                  title="Failed Auth Attempts" 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Events Trend</CardTitle>
                <CardDescription>Security incidents over time</CardDescription>
              </CardHeader>
              <CardContent>
                <HourlyTrendChart 
                  hours={24} 
                  eventClass="SecurityEvent" 
                  title="Security Events" 
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
