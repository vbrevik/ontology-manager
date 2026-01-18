
import * as React from "react"
import { Check, ChevronsUpDown, LayoutDashboard, FolderKanban, Settings } from "lucide-react"
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
import { useNavigate, useLocation } from "@tanstack/react-router"

const workspaces = [
    {
        label: "Dashboard",
        value: "dashboard",
        href: "/",
        icon: LayoutDashboard,
        color: "text-blue-500",
    },
    {
        label: "Projects",
        value: "projects",
        href: "/projects",
        icon: FolderKanban,
        color: "text-emerald-500",
    },
    {
        label: "Administration",
        value: "admin",
        href: "/admin",
        icon: Settings,
        color: "text-orange-500",
    },
]

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
    const [open, setOpen] = React.useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    const activeWorkspace = React.useMemo(() => {
        if (location.pathname === "/" || location.pathname === "") {
            return workspaces.find((w) => w.value === "dashboard")
        }
        if (location.pathname.startsWith("/projects")) {
            return workspaces.find((w) => w.value === "projects")
        }
        if (location.pathname.startsWith("/admin")) {
            return workspaces.find((w) => w.value === "admin")
        }
        return workspaces[0]
    }, [location.pathname])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between hover:bg-muted/50 transition-all active:scale-[0.98]",
                        collapsed ? "px-0 h-10 w-10 mx-auto" : "h-12 px-3"
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
            <PopoverContent className="w-[240px] p-0" align="start" side="right" sideOffset={10}>
                <Command>
                    <CommandInput placeholder="Switch workspace..." />
                    <CommandList>
                        <CommandEmpty>No workspace found.</CommandEmpty>
                        <CommandGroup heading="Workspaces">
                            {workspaces.map((workspace) => (
                                <CommandItem
                                    key={workspace.value}
                                    onSelect={() => {
                                        navigate({ to: workspace.href })
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer gap-3 py-3"
                                >
                                    <workspace.icon className={cn("h-5 w-5", workspace.color)} />
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{workspace.label}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">{workspace.value} view</span>
                                    </div>
                                    {activeWorkspace?.value === workspace.value && (
                                        <Check className="ml-auto h-4 w-4" />
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
