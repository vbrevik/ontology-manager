
import * as React from "react"
import {
    Activity,
    Check,
    ChevronsUpDown,
    ClipboardCheck,
    FolderKanban,
    Lock,
    Shield,
    Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Link, useNavigate, useLocation } from "@tanstack/react-router"
import { useAuth } from "@/features/auth/lib/context"

type WorkspaceConfig = {
    label: string
    value: string
    href: string
    icon: React.ElementType
    color: string
    description: string
    requiredPermissions?: string[]
    matchPaths?: string[]
}

const workspaces: WorkspaceConfig[] = [
    {
        label: "Projects",
        value: "projects",
        href: "/projects",
        matchPaths: ["/projects"],
        icon: FolderKanban,
        color: "text-emerald-500",
        description: "Project portfolio and tasks",
        requiredPermissions: [
            "project.read",
            "project.create",
            "project.update",
            "project.delete",
            "project.manage_members",
            "task.read",
            "task.create",
            "task.update",
            "task.delete",
        ],
    },
    {
        label: "Access Control",
        value: "access",
        href: "/admin/access",
        matchPaths: ["/admin/access", "/admin/roles", "/admin/users", "/admin/abac"],
        icon: Shield,
        color: "text-indigo-500",
        description: "Roles, policies, and permissions",
        requiredPermissions: ["ui.view.roles", "ui.view.users", "ui.view.schedules"],
    },
    {
        label: "Approvals",
        value: "approvals",
        href: "/admin/ontology/contexts",
        matchPaths: ["/admin/ontology", "/admin/ontology/contexts"],
        icon: ClipboardCheck,
        color: "text-amber-500",
        description: "Context approvals and governance",
        requiredPermissions: ["ui.view.ontology"],
    },
    {
        label: "System Status",
        value: "system-status",
        href: "/stats/system",
        matchPaths: ["/stats", "/logs", "/api-management", "/admin/discovery"],
        icon: Activity,
        color: "text-blue-500",
        description: "Metrics, logs, and services",
        requiredPermissions: ["ui.view.metrics", "ui.view.logs", "ui.view.discovery", "ui.view.api"],
    },
    {
        label: "Artificial Intelligence",
        value: "ai",
        href: "/admin/ai",
        matchPaths: ["/admin/ai"],
        icon: Sparkles,
        color: "text-purple-500",
        description: "AI orchestration and models",
        requiredPermissions: ["ui.view.ai"],
    },
    {
        label: "Security",
        value: "security",
        href: "/admin/sessions",
        matchPaths: ["/admin/sessions", "/admin/firefighter", "/admin/rate-limits"],
        icon: Lock,
        color: "text-orange-500",
        description: "Sessions, audits, and firefighter",
        requiredPermissions: ["ui.view.sessions", "ui.view.firefighter"],
    },
]

export function WorkspaceSwitcher({
    collapsed = false,
    variant = "sidebar",
    className,
}: {
    collapsed?: boolean
    variant?: "sidebar" | "navbar"
    className?: string
}) {
    const [open, setOpen] = React.useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const { isAuthenticated, hasPermission } = useAuth()

    const isNavbar = variant === "navbar"

    const hasWorkspaceAccess = React.useCallback(
        (workspace: WorkspaceConfig) => {
            if (!workspace.requiredPermissions || workspace.requiredPermissions.length === 0) {
                return true
            }
            return workspace.requiredPermissions.some((permission) => hasPermission(permission))
        },
        [hasPermission]
    )

    const visibleWorkspaces = React.useMemo(() => {
        if (!isAuthenticated) return []
        return workspaces.filter((workspace) => hasWorkspaceAccess(workspace))
    }, [hasWorkspaceAccess, isAuthenticated])

    const activeWorkspace = React.useMemo(() => {
        const match = visibleWorkspaces.find((workspace) => {
            const paths = workspace.matchPaths ?? [workspace.href]
            return paths.some((path) =>
                path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)
            )
        })

        return match ?? visibleWorkspaces[0]
    }, [location.pathname, visibleWorkspaces])

    const handleSelect = React.useCallback(
        (href: string) => {
            navigate({ to: href })
            setOpen(false)
        },
        [navigate]
    )

    if (!isAuthenticated || visibleWorkspaces.length === 0 || !activeWorkspace) {
        return null
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "justify-between hover:bg-muted/50 transition-all active:scale-[0.98]",
                        isNavbar ? "w-auto h-9 px-2" : "w-full h-12 px-3",
                        collapsed && "px-0 h-10 w-10 mx-auto",
                        isNavbar && "min-w-[190px]",
                        className
                    )}
                >
                    <div className="flex items-center gap-3 truncate">
                        {activeWorkspace && (
                            <>
                                <activeWorkspace.icon className={cn("h-5 w-5 shrink-0", activeWorkspace.color)} />
                                {!collapsed && (
                                    <span className="font-semibold text-sm truncate uppercase tracking-wider">
                                        {activeWorkspace.label}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    {!collapsed && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={cn("p-0", isNavbar ? "w-[260px]" : "w-[240px]")}
                align="start"
                side={isNavbar ? "bottom" : "right"}
                sideOffset={isNavbar ? 8 : 10}
            >
                <Command>
                    <CommandInput placeholder="Switch workspace..." />
                    <CommandList>
                        <CommandEmpty>No workspace found.</CommandEmpty>
                        <CommandGroup heading="Workspaces">
                            {visibleWorkspaces.map((workspace) => (
                                <CommandItem
                                    key={workspace.value}
                                    value={`${workspace.label} ${workspace.description}`}
                                    onSelect={() => handleSelect(workspace.href)}
                                    className="p-0"
                                >
                                    <Link
                                        to={workspace.href}
                                        onClick={() => setOpen(false)}
                                        className="flex w-full items-center gap-3 px-2 py-3"
                                    >
                                        <workspace.icon className={cn("h-5 w-5", workspace.color)} />
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{workspace.label}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">
                                                {workspace.description}
                                            </span>
                                        </div>
                                        {activeWorkspace?.value === workspace.value && (
                                            <Check className="ml-auto h-4 w-4" />
                                        )}
                                    </Link>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
