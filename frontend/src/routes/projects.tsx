import { useState, useEffect, useMemo } from 'react'
import { createFileRoute, Outlet, Link, useLocation, useParams } from '@tanstack/react-router'
import { List, ChevronLeft, ChevronRight, Home, FolderKanban } from 'lucide-react'
import { getProject, listSubProjects, type Project } from '../features/projects/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/projects')({
    component: ProjectsLayout,
})

function ProjectsLayout() {
    const location = useLocation()
    const params = useParams({ strict: false }) as { projectId?: string }
    const projectId = params.projectId

    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('projectsSidebarCollapsed') === 'true'
        }
        return false
    })

    const [activeProject, setActiveProject] = useState<Project | null>(null)
    const [subProjects, setSubProjects] = useState<Project[]>([])

    useEffect(() => {
        localStorage.setItem('projectsSidebarCollapsed', String(collapsed))
    }, [collapsed])

    useEffect(() => {
        if (projectId) {
            loadSidebarData(projectId)
        } else {
            setActiveProject(null)
            setSubProjects([])
        }
    }, [projectId])

    async function loadSidebarData(id: string) {
        try {
            const [p, s] = await Promise.all([
                getProject(id),
                listSubProjects(id)
            ])
            setActiveProject(p)
            setSubProjects(s.projects)
        } catch (err) {
            console.error('Failed to load sidebar project data', err)
        }
    }

    const navItems = useMemo(() => {
        const items = [
            { label: 'All Projects', href: '/projects', icon: List },
        ]

        if (activeProject) {
            items.push(
                { label: 'Overview', href: `/projects/${activeProject.id}`, icon: FolderKanban },
            )
        }

        return items
    }, [activeProject])

    const isActive = (href: string) => {
        if (href === '/projects') {
            return location.pathname === '/projects' || location.pathname === '/projects/'
        }
        return location.pathname.startsWith(href)
    }

    return (
        <div className="flex bg-muted/10 min-h-screen">
            {/* Projects Sidebar */}
            <aside
                className={cn(
                    "h-[calc(100vh-4rem)] sticky top-16 border-r border-border/40 bg-background/50 backdrop-blur-sm transition-all duration-300 flex flex-col",
                    collapsed ? "w-16" : "w-64"
                )}
            >
                <div className="flex-1 py-4 overflow-y-auto px-2">
                    <nav className="px-2 space-y-1">
                        {!collapsed && (
                            <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Projects
                            </h3>
                        )}
                        {navItems.map((item) => {
                            const active = isActive(item.href)
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all text-blue-500",
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

                        {!collapsed && subProjects.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-border/40">
                                <h3 className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3">
                                    Sub-projects
                                </h3>
                                <div className="space-y-1">
                                    {subProjects.map((sub) => (
                                        <Link
                                            key={sub.id}
                                            to="/projects/$projectId"
                                            params={{ projectId: sub.id }}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-all italic",
                                                location.pathname === `/projects/${sub.id}`
                                                    ? "text-emerald-500 bg-emerald-500/5 font-bold"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <FolderKanban className="h-3 w-3 flex-shrink-0 opacity-50" />
                                            <span className="truncate">{sub.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </nav>
                </div>

                <div className="p-2 border-t border-border/40 space-y-2">
                    <Link
                        to="/admin"
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full",
                            collapsed && "justify-center px-0"
                        )}
                    >
                        <Home className="h-4 w-4" />
                        {!collapsed && <span className="text-xs">Admin Console</span>}
                    </Link>

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

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
                <header className="h-[72px] px-6 border-b bg-background/50 backdrop-blur-sm flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-xl font-bold tracking-tight text-emerald-500 flex items-center gap-2">
                            Projects Workspace
                        </h1>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
