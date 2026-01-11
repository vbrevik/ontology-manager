import { createFileRoute, Outlet, useLocation, Link } from '@tanstack/react-router'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { ContextSwitcher } from '@/components/ContextSwitcher'
import { Users, Key, Terminal, Eye, ShieldAlert, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin')({
    component: AdminLayout,
})

function AdminLayout() {
    const location = useLocation();
    const isAccessRoute = location.pathname.startsWith('/admin/access');
    const isOntologyRoute = location.pathname.startsWith('/admin/ontology');

    const accessNav = [
        { title: "Explorer", href: "/admin/access/explorer", icon: Eye },
        { title: "Roles", href: "/admin/access/roles", icon: Users },
        { title: "Policies", href: "/admin/access/policies", icon: Terminal },
        { title: "Permissions", href: "/admin/access/permissions", icon: Key },
        { title: "Matrix", href: "/admin/access/matrix", icon: LayoutGrid },
        { title: "Impact", href: "/admin/access/impact", icon: ShieldAlert },
    ];

    const ontologyNav = [
        { title: "Overview", href: "/admin/ontology", icon: Eye },
        { title: "Classes", href: "/admin/ontology/Classes", icon: LayoutGrid },
        { title: "Relationships", href: "/admin/ontology/Relationships", icon: Terminal },
        { title: "Versions", href: "/admin/ontology/versions", icon: Key },
    ];

    const navItems = isAccessRoute ? accessNav : (isOntologyRoute ? ontologyNav : []);

    return (
        <div className="flex bg-muted/10 min-h-screen">
            <AdminSidebar />
            <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
                <header className="h-[72px] px-6 border-b bg-background/50 backdrop-blur-sm flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center space-x-8">
                        <h1 className={cn(
                            "text-xl font-bold tracking-tight transition-all duration-300",
                            isAccessRoute ? "text-indigo-500" : (isOntologyRoute ? "text-orange-500" : "text-foreground")
                        )}>
                            {isAccessRoute ? "Graph Security" : (isOntologyRoute ? "Graph Ontology" : "Admin Console")}
                        </h1>

                        {(isAccessRoute || isOntologyRoute) && (
                            <nav className="hidden xl:flex items-center p-1 bg-muted/30 backdrop-blur-sm rounded-xl border border-border/40 shadow-inner">
                                {navItems.map((item) => {
                                    const isActive = location.pathname === item.href || (item.href !== "/admin/ontology" && location.pathname.startsWith(item.href));
                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            className={cn(
                                                "flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 whitespace-nowrap",
                                                isActive
                                                    ? "bg-background text-primary shadow-sm shadow-primary/5 ring-1 ring-border/20"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <item.icon className={cn(
                                                "h-3.5 w-3.5 transition-transform duration-300",
                                                isActive ? "text-primary scale-110" : "opacity-60"
                                            )} />
                                            <span>{item.title}</span>
                                        </Link>
                                    )
                                })}
                            </nav>
                        )}
                    </div>
                    <div className="flex items-center space-x-4">
                        <ContextSwitcher />
                    </div>
                </header>
                <div className="p-6 h-full overflow-y-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
