import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { ContextSwitcher } from '@/components/ContextSwitcher'
import {
    AccessWorkspaceSidebar,
    ApprovalsWorkspaceSidebar,
    SecurityWorkspaceSidebar,
    SystemStatusSidebar,
    AiWorkspaceSidebar,
} from '@/components/layout/WorkspaceSidebars'
import { Activity, ClipboardCheck, Lock, Shield, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin')({
    component: AdminLayout,
})

function AdminLayout() {
    const location = useLocation();

    const workspaceConfig = (() => {
        if (location.pathname.startsWith('/admin/ai')) {
            return {
                title: 'Artificial Intelligence',
                description: 'Orchestration, providers, and models',
                icon: Sparkles,
                sidebar: <AiWorkspaceSidebar />,
                accent: 'text-purple-500',
            }
        }
        if (location.pathname.startsWith('/admin/sessions') || location.pathname.startsWith('/admin/firefighter') || location.pathname.startsWith('/admin/rate-limits')) {
            return {
                title: 'Security',
                description: 'Sessions, audits, and safeguards',
                icon: Lock,
                sidebar: <SecurityWorkspaceSidebar />,
                accent: 'text-orange-500',
            }
        }
        if (location.pathname.startsWith('/admin/discovery')) {
            return {
                title: 'System Status',
                description: 'Service discovery and health',
                icon: Activity,
                sidebar: <SystemStatusSidebar />,
                accent: 'text-blue-500',
            }
        }
        if (location.pathname.startsWith('/admin/ontology')) {
            return {
                title: 'Approvals',
                description: 'Governance, contexts, and schema',
                icon: ClipboardCheck,
                sidebar: <ApprovalsWorkspaceSidebar />,
                accent: 'text-amber-500',
            }
        }
        return {
            title: 'Access Control',
            description: 'Roles, policies, and permissions',
            icon: Shield,
            sidebar: <AccessWorkspaceSidebar />,
            accent: 'text-indigo-500',
        }
    })()

    return (
        <div className="flex bg-muted/10 min-h-screen">
            {workspaceConfig.sidebar}
            <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
                <header className="h-[72px] px-6 border-b bg-background/50 backdrop-blur-sm flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <div className={cn("h-10 w-10 rounded-2xl bg-muted/60 flex items-center justify-center", workspaceConfig.accent)}>
                            <workspaceConfig.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className={cn("text-xl font-bold tracking-tight", workspaceConfig.accent)}>
                                {workspaceConfig.title}
                            </h1>
                            <p className="text-xs text-muted-foreground">{workspaceConfig.description}</p>
                        </div>
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
