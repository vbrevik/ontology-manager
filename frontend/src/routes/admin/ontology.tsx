import { createFileRoute, Outlet, Link, useLocation } from '@tanstack/react-router'
import { Database, Share2, Layers, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/ontology')({
    component: OntologyLayout,
})

function OntologyLayout() {
    const location = useLocation();

    const navItems = [
        {
            title: "Overview",
            href: "/admin/ontology",
            icon: Database,
            description: "Ontology health and metrics"
        },
        {
            title: "Classes & Properties",
            href: "/admin/ontology/classes",
            icon: Layers,
            description: "Manage schema inheritance"
        },
        {
            title: "Relationship Types",
            href: "/admin/ontology/Relationships",
            icon: Share2,
            description: "Graph edge configuration"
        },
        {
            title: "Graph Explorer",
            href: "/admin/ontology/Graph",
            icon: Layers,
            description: "Visual schema inheritance"
        },
        {
            title: "Schema Versions",
            href: "/admin/ontology/versions",
            icon: Database,
            description: "Manage ontology iterations"
        }
    ];

    return (
        <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
            {/* Header / Breadcrumbs */}
            <div className="border-b border-border/50 bg-background/30 px-8 py-4 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                    <Link to="/admin" className="hover:text-primary transition-colors">Admin</Link>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-foreground font-medium">Ontology Manager</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
                    Graph Ontology Suite
                </h1>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Secondary Sidebar */}
                <aside className="w-64 border-r border-border/40 bg-background/20 hidden md:block overflow-y-auto">
                    <nav className="p-4 space-y-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "flex flex-col p-3 rounded-xl transition-all duration-200 group",
                                        isActive
                                            ? "bg-orange-500/10 border border-orange-500/20 text-orange-500"
                                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center space-x-3 mb-1">
                                        <item.icon className={cn(
                                            "h-5 w-5 transition-transform group-hover:scale-110",
                                            isActive ? "text-orange-500" : "text-muted-foreground/70"
                                        )} />
                                        <span className="font-semibold text-sm">{item.title}</span>
                                    </div>
                                    <p className="text-[10px] opacity-70 leading-tight">
                                        {item.description}
                                    </p>
                                </Link>
                            )
                        })}
                    </nav>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto relative">
                    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
