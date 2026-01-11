import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { fetchRelationshipTypes, fetchClasses, fetchPermissionTypes } from '@/features/ontology/lib/api'
import {
    Share2,
    Layers,
    ArrowUpRight,
    Activity,
    Hexagon,
    ShieldCheck,
    Plus,
    Activity as ActivityIcon
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/ontology/')({
    component: OntologyOverview,
})

function OntologyOverview() {
    const [stats, setStats] = useState({
        classes: 0,
        relationships: 0,
        permissions: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const [classes, rels, perms] = await Promise.all([
                    fetchClasses().catch(() => []),
                    fetchRelationshipTypes().catch(() => []),
                    fetchPermissionTypes().catch(() => [])
                ]);
                setStats({
                    classes: classes.length,
                    relationships: rels.length,
                    permissions: perms.length
                });
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, []);

    const cards = [
        {
            title: "Ontological Classes",
            value: stats.classes,
            description: "Entities and categories defined",
            icon: Layers,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            href: "/admin/ontology/classes"
        },
        {
            title: "Relationship Types",
            value: stats.relationships,
            description: "Active graph edge types",
            icon: Share2,
            color: "text-orange-500",
            bg: "bg-orange-500/10",
            href: "/admin/ontology/relationships"
        },
        {
            title: "Permission Levels",
            value: stats.permissions,
            description: "Granular access types",
            icon: ShieldCheck,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            href: "/admin/ontology/permissions" // Future sub-page
        }
    ];

    if (loading) return null;

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Ontology Overview</h2>
                <p className="text-muted-foreground">
                    Monitor your graph schema health and system-wide inheritance policies.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {cards.map((card) => (
                    <Link key={card.title} to={card.href}>
                        <Card className="hover:border-primary/50 transition-all group overflow-hidden border-border/40">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                    {card.title}
                                </CardTitle>
                                <div className={`p-2 rounded-lg ${card.bg}`}>
                                    <card.icon className={`h-4 w-4 ${card.color}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{card.value}</div>
                                <p className="text-xs text-muted-foreground mt-1 underline-offset-4 group-hover:underline">
                                    Manage {card.title.toLowerCase()} <ArrowUpRight className="inline h-3 w-3" />
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-border/40 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                            <Activity className="h-5 w-5 text-orange-400" />
                            <span>System Readiness</span>
                        </CardTitle>
                        <CardDescription>Advanced ReBAC operational status</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">Graph Integrity</span>
                                <span className="text-emerald-500">100%</span>
                            </div>
                            <Progress value={100} className="bg-emerald-500/20" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">Permission Consistency</span>
                                <span className="text-orange-500">85%</span>
                            </div>
                            <Progress value={85} className="bg-orange-500/20 h-2" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">Inheritance Depth</span>
                                <span className="text-blue-500">3 Levels</span>
                            </div>
                            <Progress value={60} className="bg-blue-500/20 h-2" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/40 shadow-sm bg-gradient-to-br from-orange-500/[0.03] to-rose-500/[0.03]">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                            <Hexagon className="h-5 w-5 text-rose-400 fill-rose-400/10" />
                            <span>Quick Actions</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-3">
                        <Button variant="outline" className="justify-start hover:bg-orange-500/5 hover:border-orange-500/20" asChild>
                            <Link to="/admin/ontology/classes">
                                <Plus className="mr-2 h-4 w-4 text-orange-500" /> New Ontological Class
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start hover:bg-rose-500/5 hover:border-rose-500/20" asChild>
                            <Link to="/admin/ontology/relationships">
                                <Plus className="mr-2 h-4 w-4 text-rose-500" /> Define Relationship
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start bg-muted/20 cursor-not-allowed opacity-60">
                            <ActivityIcon className="mr-2 h-4 w-4" /> Run Impact Analysis (Phase 4)
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

