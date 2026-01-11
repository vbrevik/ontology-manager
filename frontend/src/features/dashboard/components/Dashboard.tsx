import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { User, Users, Activity, ShieldCheck, Zap, Download, FileText, Key, ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'

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

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        const [statsRes, activityRes] = await Promise.all([
          fetch('/api/stats', { credentials: 'include' }),
          fetch('/api/activity', { credentials: 'include' }),
        ])

        if (!statsRes.ok || !activityRes.ok) {
          throw new Error('Failed to fetch dashboard data')
        }

        const statsJson = await statsRes.json()
        const activityJson = await activityRes.json()

        if (!mounted) return
        setStats(statsJson)
        setActivity(activityJson)
      } catch (err: any) {
        if (!mounted) return
        setError(err.message || 'Unknown error')
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    }

    fetchData()
    return () => {
      mounted = false
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading intelligence...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Sync Error</h2>
          <p className="text-red-600 dark:text-red-500 mb-6 max-w-md">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.total_users ?? '—',
      trend: '+12.5%',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      href: '/stats/users'
    },
    {
      label: 'Active Sessions',
      value: stats?.active_refresh_tokens ?? '—',
      trend: '+5.2%',
      icon: Activity,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      href: '/stats/sessions'
    },
    {
      label: 'System Status',
      value: 'Operational',
      trend: '100%',
      icon: ShieldCheck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      href: '/stats/system'
    },
  ]

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time insights and management for your application.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 px-4 flex items-center bg-muted/50 border border-border/50 rounded-lg text-xs font-medium text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <Link key={i} to={stat.href}>
            <Card className="relative overflow-hidden border-border/60 hover:border-primary/50 transition-all hover:shadow-md group cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} transition-colors group-hover:scale-110 duration-300`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="text-emerald-500 font-bold">{stat.trend}</span> from last period
                </p>
              </CardContent>
              <div className="absolute bottom-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className={`h-5 w-5 ${stat.color}`} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent activity */}
        <Card className="lg:col-span-2 border-border/60 overflow-hidden shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/20 pb-4">
            <div className="space-y-0.5">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest user registrations and interactions</CardDescription>
            </div>
            <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {activity.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/40">
                      <th className="px-6 py-3 font-bold">Identity</th>
                      <th className="px-6 py-3 font-bold">Created</th>
                      <th className="px-6 py-3 font-bold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {activity.map((r: ActivityEntry) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors group cursor-default">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {r.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-semibold group-hover:text-primary transition-colors">{r.username}</div>
                              <div className="text-xs text-muted-foreground">{r.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 capitalize">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Activity className="w-6 h-6 opacity-20" />
                </div>
                <p className="italic text-sm">No recent activity found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Tips */}
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Control</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {[
                { label: 'Create User', icon: User, color: 'text-indigo-500', href: '/admin/new' },
                { label: 'Export Report', icon: Download, color: 'text-amber-500', href: '/reports' },
                { label: 'System Logs', icon: FileText, color: 'text-cyan-500', href: '/logs' },
                { label: 'API Management', icon: Key, color: 'text-rose-500', href: '/api-management' },
              ].map((action, i) => (
                <Link
                  key={i}
                  to={action.href}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted border border-transparent hover:border-border/50 rounded-xl text-sm font-medium transition-all group"
                >
                  <span className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-background border border-border shadow-sm group-hover:shadow ${action.color}`}>
                      <action.icon size={16} />
                    </div>
                    {action.label}
                  </span>
                  <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/10 shadow-none border-dashed">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Zap size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-1.5">Pro Tip</h4>
                  <p className="text-xs text-primary/80 leading-relaxed font-medium">
                    Customize your data views and notifications in the settings panel to optimize your workflow.
                  </p>
                  <button className="mt-2 text-[11px] font-bold text-primary underline underline-offset-4 hover:text-primary/70 transition-colors">
                    View Documentation
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


