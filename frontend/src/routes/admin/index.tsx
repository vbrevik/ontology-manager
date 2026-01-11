import { useNavigate, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Activity,
    Shield,
    Users,
    Zap,
    Lock,
    Globe,
    ShieldAlert,
    Loader2
} from "lucide-react"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAbac } from '@/features/abac/lib/abac'

export const Route = createFileRoute('/admin/')({
    component: AdminDashboard,
})

interface AdminStats {
    total_users: number;
    user_growth: number;
    active_roles: number;
    role_growth: number;
    ontology_classes: number;
    class_growth: number;
    policy_denials: number;
    denial_growth: number;
    access_traffic: { name: string; access: number; denies: number }[];
}

function AdminDashboard() {
    const navigate = useNavigate()
    const { hasRole } = useAbac();
    const isAdmin = hasRole('superadmin') || hasRole('admin');
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin) return;

        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin-stats');
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                } else {
                    console.error("Failed to fetch admin stats");
                }
            } catch (e) {
                console.error("Error fetching admin stats", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [isAdmin]);

    if (!isAdmin) {
        return (
            <div className="p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to access the Administration Dashboard.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const statCards = [
        {
            title: "Total Users",
            value: stats?.total_users.toLocaleString() || "0",
            change: `${stats?.user_growth.toFixed(1)}%`,
            icon: Users,
            trend: (stats?.user_growth || 0) >= 0 ? "up" : "down"
        },
        {
            title: "Active Roles",
            value: stats?.active_roles.toLocaleString() || "0",
            change: `${stats?.role_growth.toFixed(1)}%`,
            icon: Shield,
            trend: (stats?.role_growth || 0) >= 0 ? "up" : "down"
        },
        {
            title: "Ontology Classes",
            value: stats?.ontology_classes.toLocaleString() || "0",
            change: `${stats?.class_growth.toFixed(1)}%`,
            icon: Globe,
            trend: (stats?.class_growth || 0) >= 0 ? "up" : "down"
        },
        {
            title: "Policy Denials",
            value: stats?.policy_denials.toLocaleString() || "0",
            change: `${stats?.denial_growth.toFixed(1)}%`,
            icon: Lock,
            trend: (stats?.denial_growth || 0) <= 0 ? "up" : "down" // fewer denials is "up" (good)? Or just direction. Let's keep direction.
        }
    ]



    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Security Overview</h2>
                    <p className="text-muted-foreground mt-1">Real-time insights into your ReBAC graph.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" className="h-9">
                        <Activity className="mr-2 h-4 w-4" />
                        System Health
                    </Button>
                    <Button className="h-9 bg-primary/90 hover:bg-primary">
                        Download Report
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, i) => (
                    <Card key={i} className="hover:shadow-lg transition-all duration-300 border-border/50 bg-background/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className={`text-xs ${stat.trend === 'up' ? 'text-green-500' : stat.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'} flex items-center mt-1`}>
                                {stat.trend === 'up' ? <Zap className="h-3 w-3 mr-1" /> : null}
                                {stat.change} from last month
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 border-border/50 bg-background/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Access Traffic</CardTitle>
                        <CardDescription>
                            Successful access grants vs. policy denials over time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart data={stats?.access_traffic || []}>
                                    <XAxis
                                        dataKey="name"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="access" name="Granted" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="denies" name="Denied" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3 border-border/50 bg-background/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>
                            Common management tasks.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div
                                onClick={() => navigate({ to: '/admin/users' })}
                                className="flex items-center p-3 cursor-pointer hover:bg-muted/50 rounded-xl border border-transparent hover:border-border/50 transition-all group"
                            >
                                <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">Manage Users</p>
                                    <p className="text-xs text-muted-foreground">Add or modify system users</p>
                                </div>
                            </div>
                            <div
                                onClick={() => navigate({ to: '/admin/ontology/Classes' })}
                                className="flex items-center p-3 cursor-pointer hover:bg-muted/50 rounded-xl border border-transparent hover:border-border/50 transition-all group"
                            >
                                <div className="h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                    <Globe className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">Ontology Editor</p>
                                    <p className="text-xs text-muted-foreground">Modify schema classes</p>
                                </div>
                            </div>
                            <div
                                onClick={() => navigate({ to: '/admin/access/Roles' })}
                                className="flex items-center p-3 cursor-pointer hover:bg-muted/50 rounded-xl border border-transparent hover:border-border/50 transition-all group"
                            >
                                <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                    <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">Role Permissions</p>
                                    <p className="text-xs text-muted-foreground">Configure access matrices</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
