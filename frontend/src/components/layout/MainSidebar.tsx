
import { Link, useLocation } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
    LayoutDashboard,
    FolderKanban,
    Settings,
    FileText,
    Activity,
    ChevronLeft,
    ChevronRight,
    Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const mainNavItems = [
    {
        label: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
    },
    {
        label: 'Projects',
        href: '/projects',
        icon: FolderKanban,
    },
    {
        label: 'Administration',
        href: '/admin',
        icon: Settings,
    },
    {
        label: 'System Metrics',
        href: '/stats/system',
        icon: Activity,
    },
    {
        label: 'System Logs',
        href: '/logs',
        icon: FileText,
    },
    {
        label: 'AI Orchestrator',
        href: '/admin/ai',
        icon: Sparkles,
    },
]

export function MainSidebar() {
    const location = useLocation()
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('mainSidebarCollapsed') === 'true'
        }
        return false
    })

    useEffect(() => {
        localStorage.setItem('mainSidebarCollapsed', String(collapsed))
    }, [collapsed])

    const isActive = (href: string) => {
        if (href === '/') {
            return location.pathname === '/' || location.pathname === ''
        }
        return location.pathname.startsWith(href)
    }

    return (
        <aside
            className={cn(
                "h-[calc(100vh-4rem)] sticky top-16 border-r border-border/40 bg-background/50 backdrop-blur-sm transition-all duration-300 flex flex-col z-40",
                collapsed ? "w-16" : "w-64"
            )}
        >
            <div className="flex-1 py-4 overflow-y-auto">
                <nav className="px-2 space-y-1">
                    {!collapsed && (
                        <h3 className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                            Main Menu
                        </h3>
                    )}
                    {mainNavItems.map((item) => {
                        const active = isActive(item.href)
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                                    active
                                        ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                    collapsed && "justify-center px-0 h-10 w-10 mx-auto"
                                )}
                                title={collapsed ? item.label : undefined}
                            >
                                <Icon className={cn(
                                    "h-4 w-4 flex-shrink-0 transition-transform duration-300",
                                    active ? "text-primary scale-110" : "group-hover:scale-110"
                                )} />
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
                        "w-full flex items-center gap-2 text-muted-foreground hover:text-foreground h-9",
                        collapsed && "justify-center"
                    )}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <>
                            <ChevronLeft className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Collapse</span>
                        </>
                    )}
                </Button>
            </div>
        </aside>
    )
}
