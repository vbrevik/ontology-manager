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
    Workflow,
    Layers,
    Sparkles,
    Flame
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/lib/context'
import { FirefighterDialog } from '@/components/firefighter/FirefighterDialog'
import { evaluateNavigation, type NavSectionVisibility } from '@/features/navigation/lib/api'
import { WorkspaceSwitcher } from '@/components/ui/workspace-switcher'

interface NavItem {
    id: string
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
                id: 'admin.dashboard',
                label: 'Dashboard',
                href: '/admin',
                icon: LayoutDashboard,
                requiredPermission: 'ui.view.dashboard',
            },
            {
                id: 'admin.users',
                label: 'User Management',
                href: '/admin/users',
                icon: Users,
                requiredPermission: 'ui.view.users',
            },
            {
                id: 'admin.sessions',
                label: 'Session Management',
                href: '/admin/sessions',
                icon: Lock,
                requiredPermission: 'ui.view.sessions',
            },
            {
                id: 'admin.firefighter',
                label: 'Firefighter Audit',
                href: '/admin/firefighter',
                icon: Flame,
                requiredPermission: 'ui.view.firefighter',
            },
        ]
    },
    {
        section: 'Role Management',
        items: [
            {
                id: 'admin.roles.designer',
                label: 'Role Designer',
                href: '/admin/roles/designer',
                icon: Shield,
                requiredPermission: 'ui.view.roles',
            },
            {
                id: 'admin.roles.manager',
                label: 'Role Manager',
                href: '/admin/roles/manager',
                icon: Shield, // We can find a better one later
                requiredPermission: 'ui.view.roles',
            },
            {
                id: 'admin.schedules',
                label: 'Access Schedules',
                href: '/admin/schedules',
                icon: Clock,
                requiredPermission: 'ui.view.schedules',
            },
            {
                id: 'admin.roles.delegation',
                label: 'Delegation Rules',
                href: '/admin/roles/delegation',
                icon: Workflow,
                requiredPermission: 'ui.view.roles',
            },
            {
                id: 'admin.navigation',
                label: 'Navigation Simulator',
                href: '/admin/navigation',
                icon: Workflow,
                requiredPermission: 'ui.view.roles',
            },
        ]
    },
    {
        section: 'Ontology Engine',
        items: [
            {
                id: 'admin.ontology.designer',
                label: 'Ontology Designer',
                href: '/admin/ontology/designer',
                icon: Database,
                requiredPermission: 'ui.view.ontology',
            },
            {
                id: 'admin.ontology.classes',
                label: 'Class Manager',
                href: '/admin/ontology/Classes',
                icon: Layers,
                requiredPermission: 'ui.view.ontology',
            },
            {
                id: 'admin.ontology.contexts',
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
                id: 'admin.discovery',
                label: 'Service Discovery',
                href: '/admin/discovery',
                icon: Radio,
                requiredPermission: 'ui.view.discovery',
            },
            {
                id: 'stats.system',
                label: 'System Metrics',
                href: '/stats/system',
                icon: Activity,
                requiredPermission: 'ui.view.metrics',
            },
            {
                id: 'system.logs',
                label: 'System Logs',
                href: '/logs',
                icon: FileText,
                requiredPermission: 'ui.view.logs',
            },
            {
                id: 'admin.ai',
                label: 'AI Orchestrator',
                href: '/admin/ai',
                icon: Sparkles,
                requiredPermission: 'ui.view.ai',
            },
            {
                id: 'api.management',
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
    const { hasPermission, isAuthenticated } = useAuth()
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('adminSidebarCollapsed') === 'true'
        }
        return false
    })
    const [firefighterOpen, setFirefighterOpen] = useState(false)
    const [navVisibility, setNavVisibility] = useState<Record<string, boolean> | null>(null)

    useEffect(() => {
        localStorage.setItem('adminSidebarCollapsed', String(collapsed))
    }, [collapsed])

    useEffect(() => {
        if (!isAuthenticated) return
        let mounted = true

        evaluateNavigation()
            .then((sections: NavSectionVisibility[]) => {
                if (!mounted) return
                const visibility: Record<string, boolean> = {}
                sections.forEach(section => {
                    section.items.forEach(item => {
                        visibility[item.id] = item.visible
                    })
                })
                setNavVisibility(visibility)
            })
            .catch(() => {
                if (mounted) {
                    setNavVisibility(null)
                }
            })

        return () => {
            mounted = false
        }
    }, [isAuthenticated])

    const isActive = (href: string) => {
        if (href === '/admin') {
            return location.pathname === '/admin' || location.pathname === '/admin/'
        }
        return location.pathname.startsWith(href)
    }

    const checkPermission = (requiredPermission?: string, itemId?: string) => {
        if (!requiredPermission) return true
        if (previewPermissions) {
            return previewPermissions.includes(requiredPermission) || previewPermissions.includes('*');
        }
        if (itemId && navVisibility && itemId in navVisibility) {
            return navVisibility[itemId]
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
            <div className="p-3 border-b border-border/40">
                <WorkspaceSwitcher collapsed={collapsed} />
            </div>
            <div className="flex-1 py-4 overflow-y-auto">
                <nav className="px-2 space-y-6">
                    {navItems.map((section) => {
                        const visibleItems = section.items.filter(item => checkPermission(item.requiredPermission, item.id))
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

            <div className="p-2 border-t border-border/40 space-y-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFirefighterOpen(true)}
                    className={cn(
                        "w-full flex items-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700",
                        collapsed && "justify-center px-0"
                    )}
                >
                    <Flame className="h-4 w-4" />
                    {!collapsed && <span className="text-xs font-semibold">Firefighter Mode</span>}
                </Button>

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

            <FirefighterDialog
                open={firefighterOpen}
                onOpenChange={setFirefighterOpen}
                onActivated={() => window.location.reload()}
            />
        </aside>
    )
}
