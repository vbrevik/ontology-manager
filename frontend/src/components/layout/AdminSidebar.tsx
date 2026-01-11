import { Link, useLocation } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
    ChevronLeft,
    ChevronRight,
    LayoutDashboard,
    Users,
    Shield,
    Activity,
    Radio,
    Lock,
    FileText,
    Database,
    Clock,
    Workflow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/lib/context'

interface NavItem {
    label: string
    href: string
    icon: React.ElementType
    children?: { label: string; href: string }[]
    requiredPermission?: string
}

const navItems: { section: string; items: NavItem[] }[] = [
    {
        section: 'Identity & Access',
        items: [
            {
                label: 'Dashboard',
                href: '/admin',
                icon: LayoutDashboard,
                requiredPermission: 'ui.view.dashboard',
            },
            {
                label: 'User Management',
                href: '/admin/users',
                icon: Users,
                requiredPermission: 'ui.view.users',
            },
            {
                label: 'Session Management',
                href: '/admin/sessions',
                icon: Lock,
                requiredPermission: 'ui.view.sessions',
            },
        ]
    },
    {
        section: 'Role Management',
        items: [
            {
                label: 'Role Designer',
                href: '/admin/roles/designer',
                icon: Shield,
                requiredPermission: 'ui.view.roles',
            },
            {
                label: 'Role Manager',
                href: '/admin/roles/manager',
                icon: Shield, // We can find a better one later
                requiredPermission: 'ui.view.roles',
            },
            {
                label: 'Access Schedules',
                href: '/admin/schedules',
                icon: Clock,
                requiredPermission: 'ui.view.schedules',
            },
        ]
    },
    {
        section: 'Ontology Engine',
        items: [
            {
                label: 'Ontology Designer',
                href: '/admin/ontology/designer',
                icon: Database,
                requiredPermission: 'ui.view.ontology',
            },
            {
                label: 'Ontology Manager',
                href: '/admin/ontology/manager',
                icon: Radio,
                requiredPermission: 'ui.view.ontology',
            },
            {
                label: 'Context Management',
                href: '/admin/ontology/contexts',
                icon: Workflow,
                requiredPermission: 'ui.view.ontology',
            },
        ]
    },
    {
        section: 'System & Observability',
        items: [
            {
                label: 'Service Discovery',
                href: '/admin/discovery',
                icon: Radio,
                requiredPermission: 'ui.view.discovery',
            },
            {
                label: 'System Metrics',
                href: '/stats/system',
                icon: Activity,
                requiredPermission: 'ui.view.metrics',
            },
            {
                label: 'System Logs',
                href: '/logs',
                icon: FileText,
                requiredPermission: 'ui.view.logs',
            },
            {
                label: 'API Status',
                href: '/api-management',
                icon: Database,
                requiredPermission: 'ui.view.api',
            },
        ]
    }
]

export function AdminSidebar({ previewPermissions }: { previewPermissions?: string[] } = {}) {
    const location = useLocation()
    const { hasPermission } = useAuth()
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('adminSidebarCollapsed') === 'true'
        }
        return false
    })

    useEffect(() => {
        localStorage.setItem('adminSidebarCollapsed', String(collapsed))
    }, [collapsed])

    const isActive = (href: string) => {
        if (href === '/admin') {
            return location.pathname === '/admin' || location.pathname === '/admin/'
        }
        return location.pathname.startsWith(href)
    }

    const checkPermission = (requiredPermission?: string) => {
        if (!requiredPermission) return true
        if (previewPermissions) {
            return previewPermissions.includes(requiredPermission) || previewPermissions.includes('*');
        }
        return hasPermission(requiredPermission)
    }

    return (
        <aside
            className={cn(
                "h-[calc(100vh-4rem)] sticky top-16 border-r border-border/40 bg-background/50 backdrop-blur-sm transition-all duration-300 flex flex-col",
                collapsed ? "w-16" : "w-64"
            )}
        >
            <div className="flex-1 py-4 overflow-y-auto">
                <nav className="px-2 space-y-6">
                    {navItems.map((section) => {
                        const visibleItems = section.items.filter(item => checkPermission(item.requiredPermission))
                        if (visibleItems.length === 0) return null

                        return (
                            <div key={section.section} className="space-y-1">
                                {!collapsed && (
                                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        {section.section}
                                    </h3>
                                )}
                                {visibleItems.map((item) => {
                                    const active = isActive(item.href)
                                    const Icon = item.icon

                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                                active
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                                collapsed && "justify-center px-2"
                                            )}
                                            title={collapsed ? item.label : undefined}
                                        >
                                            <Icon className={cn("h-4 w-4 flex-shrink-0", active && "text-primary")} />
                                            {!collapsed && <span className="truncate">{item.label}</span>}
                                        </Link>
                                    )
                                })}
                            </div>
                        )
                    })}
                </nav>
            </div>

            <div className="p-2 border-t border-border/40">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "w-full flex items-center gap-2 text-muted-foreground hover:text-foreground",
                        collapsed && "justify-center"
                    )}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <>
                            <ChevronLeft className="h-4 w-4" />
                            <span className="text-xs">Collapse</span>
                        </>
                    )}
                </Button>
            </div>
        </aside>
    )
}
