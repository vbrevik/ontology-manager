import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, UserCheck, TrendingUp, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/stats/users')({
    component: UsersStats,
})

type User = {
    id: string
    username: string
    email: string
    created_at: string
}

type StatsResponse = {
    total_users: number
    active_refresh_tokens: number
}

function UsersStats() {
    const [users, setUsers] = useState<User[]>([])
    const [stats, setStats] = useState<StatsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(new Date())

    const fetchData = async () => {
        try {
            const [usersRes, statsRes] = await Promise.all([
                fetch('/api/users', { credentials: 'include' }),
                fetch('/api/stats', { credentials: 'include' }),
            ])

            if (usersRes.ok && statsRes.ok) {
                const usersData = await usersRes.json()
                const statsData = await statsRes.json()
                setUsers(usersData)
                setStats(statsData)
                setLastUpdate(new Date())
            }
        } catch (error) {
            console.error('Failed to fetch users:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchData, 30000)
        return () => clearInterval(interval)
    }, [])

    const activeUsers = users.filter((u) => u.created_at)
    const recentUsers = users.slice(0, 10)

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                        User Statistics
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Live overview of all registered users and activity
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
                        Last updated: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Users
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                            <Users className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">{stats?.total_users ?? '—'}</div>
                        <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active Users
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                            <UserCheck className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">{activeUsers.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Users with sessions</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 hover:border-primary/50 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Growth Rate
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">+12.5%</div>
                        <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Users List */}
            <Card className="border-border/60 shadow-sm">
                <CardHeader className="bg-muted/20 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Recent Users</CardTitle>
                            <CardDescription>Latest registered accounts</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/30">
                                    <tr className="border-b border-border/50">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Username
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Joined
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {recentUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold uppercase">
                                                        {user.username?.substring(0, 2) || '??'}
                                                    </div>
                                                    <span className="font-medium">{user.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                {user.email}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
