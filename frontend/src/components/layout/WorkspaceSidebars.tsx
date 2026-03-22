import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import {
    Activity,
    ClipboardCheck,
    FileText,
    FolderKanban,
    Lock,
    Shield,
    Sparkles,
    Users,
    Workflow,
    Database,
    ShieldAlert,
    Clock,
    ChevronLeft,
    ChevronRight,
    Network,
    Gauge,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/lib/context'

interface WorkspaceNavItem {
    label: string
    href: string
    icon: React.ElementType
    requiredPermission?: string
}

interface WorkspaceSidebarProps {
    title: string
    storageKey: string
    accentClass: string
    items: WorkspaceNavItem[]
}

function WorkspaceSidebar({ title, storageKey, accentClass, items }: WorkspaceSidebarProps) {
    const location = useLocation()
    const { hasPermission } = useAuth()
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(storageKey) === 'true'
        }
        return false
    })

    useEffect(() => {
        localStorage.setItem(storageKey, String(collapsed))
    }, [collapsed, storageKey])

    const visibleItems = useMemo(
        () =>
            items.filter(
                (item) => !item.requiredPermission || hasPermission(item.requiredPermission)
            ),
        [hasPermission, items]
    )

    const isActive = (href: string) => {
        if (href === '/') {
            return location.pathname === '/' || location.pathname === ''
        }
        return location.pathname === href || location.pathname.startsWith(href)
    }

    if (visibleItems.length === 0) {
        return null
    }

    return (
        <aside
            className={cn(
                "h-[calc(100vh-4rem)] sticky top-16 border-r border-border/40 bg-background/50 backdrop-blur-sm transition-all duration-300 flex flex-col",
                collapsed ? "w-16" : "w-64"
            )}
        >
            <div className="p-3 border-b border-border/40">
                <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
                    <div
                        className={cn(
                            "h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center",
                            accentClass
                        )}
                    >
                        <Workflow className="h-4 w-4" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Workspace
                            </span>
                            <span className="text-sm font-semibold">{title}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 py-4 overflow-y-auto">
                <nav className="px-2 space-y-1">
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

export function AccessWorkspaceSidebar() {
    return (
        <WorkspaceSidebar
            title="Access Control"
            storageKey="accessSidebarCollapsed"
            accentClass="text-indigo-500"
            items={[
                { label: "Access Overview", href: "/admin/access", icon: Shield, requiredPermission: "ui.view.roles" },
                { label: "Roles & Assignments", href: "/admin/access/Roles", icon: Users, requiredPermission: "ui.view.roles" },
                { label: "Policy Playground", href: "/admin/access/policies", icon: ShieldAlert, requiredPermission: "ui.view.roles" },
                { label: "Permissions", href: "/admin/access/Permissions", icon: Lock, requiredPermission: "ui.view.roles" },
                { label: "Access Matrix", href: "/admin/access/Matrix", icon: ClipboardCheck, requiredPermission: "ui.view.roles" },
                { label: "Impact Analysis", href: "/admin/access/impact", icon: Gauge, requiredPermission: "ui.view.roles" },
                { label: "Explorer", href: "/admin/access/explorer", icon: Network, requiredPermission: "ui.view.roles" },
                { label: "User Management", href: "/admin/users", icon: Users, requiredPermission: "ui.view.users" },
            ]}
        />
    )
}

export function ApprovalsWorkspaceSidebar() {
    return (
        <WorkspaceSidebar
            title="Approvals"
            storageKey="approvalsSidebarCollapsed"
            accentClass="text-amber-500"
            items={[
                { label: "Context Approvals", href: "/admin/ontology/contexts", icon: ClipboardCheck, requiredPermission: "ui.view.ontology" },
                { label: "Ontology Designer", href: "/admin/ontology/designer", icon: Database, requiredPermission: "ui.view.ontology" },
                { label: "Classes", href: "/admin/ontology/Classes", icon: Database, requiredPermission: "ui.view.ontology" },
                { label: "Relationships", href: "/admin/ontology/Relationships", icon: Workflow, requiredPermission: "ui.view.ontology" },
                { label: "Schema Versions", href: "/admin/ontology/versions", icon: Clock, requiredPermission: "ui.view.ontology" },
            ]}
        />
    )
}

export function SystemStatusSidebar() {
    return (
        <WorkspaceSidebar
            title="System Status"
            storageKey="systemStatusSidebarCollapsed"
            accentClass="text-blue-500"
            items={[
                { label: "System Metrics", href: "/stats/system", icon: Activity, requiredPermission: "ui.view.metrics" },
                { label: "User Metrics", href: "/stats/users", icon: Users, requiredPermission: "ui.view.metrics" },
                { label: "Session Metrics", href: "/stats/sessions", icon: Lock, requiredPermission: "ui.view.metrics" },
                { label: "System Logs", href: "/logs", icon: FileText, requiredPermission: "ui.view.logs" },
                { label: "API Status", href: "/api-management", icon: Gauge, requiredPermission: "ui.view.api" },
                { label: "Service Discovery", href: "/admin/discovery", icon: Network, requiredPermission: "ui.view.discovery" },
            ]}
        />
    )
}

export function SecurityWorkspaceSidebar() {
    return (
        <WorkspaceSidebar
            title="Security"
            storageKey="securitySidebarCollapsed"
            accentClass="text-orange-500"
            items={[
                { label: "Session Management", href: "/admin/sessions", icon: Lock, requiredPermission: "ui.view.sessions" },
                { label: "Firefighter Audit", href: "/admin/firefighter", icon: ShieldAlert, requiredPermission: "ui.view.firefighter" },
                { label: "Rate Limits", href: "/admin/rate-limits", icon: Activity, requiredPermission: "ui.view.api" },
            ]}
        />
    )
}

export function AiWorkspaceSidebar() {
    return (
        <WorkspaceSidebar
            title="Artificial Intelligence"
            storageKey="aiSidebarCollapsed"
            accentClass="text-purple-500"
            items={[
                { label: "AI Orchestrator", href: "/admin/ai", icon: Sparkles, requiredPermission: "ui.view.ai" },
            ]}
        />
    )
}

export function ProjectsWorkspaceSidebar() {
    return (
        <WorkspaceSidebar
            title="Projects"
            storageKey="projectsSidebarCollapsed"
            accentClass="text-emerald-500"
            items={[
                { label: "All Projects", href: "/projects", icon: FolderKanban, requiredPermission: "project.read" },
            ]}
        />
    )
}
