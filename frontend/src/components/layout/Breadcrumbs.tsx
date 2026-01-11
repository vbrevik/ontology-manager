import { Link, useLocation } from '@tanstack/react-router'
import { Home } from 'lucide-react'
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

// Human-readable labels for route segments
const routeLabels: Record<string, string> = {
    admin: 'Administration',
    discovery: 'Service Discovery',
    users: 'User Management',
    abac: 'Access Control',
    profile: 'Profile',
    stats: 'Statistics',
    system: 'System Metrics',
    debug: 'Debug',
    logs: 'System Logs',
}

export function Breadcrumbs() {
    const location = useLocation()
    const pathSegments = location.pathname.split('/').filter(Boolean)

    // Don't show breadcrumbs on home page
    if (pathSegments.length === 0) {
        return null
    }

    const crumbs = pathSegments.map((segment, index) => {
        const path = '/' + pathSegments.slice(0, index + 1).join('/')
        const isLast = index === pathSegments.length - 1

        // Check if this looks like a UUID (for dynamic segments)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)

        // Get human-readable label
        let label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
        if (isUuid) {
            label = 'Details'
        }

        return { path, label, isLast }
    })

    return (
        <div className="px-6 py-3 border-b border-border/30 bg-muted/20">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link to="/" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                <Home className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only">Home</span>
                            </Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>

                    {crumbs.map((crumb) => (
                        <span key={crumb.path} className="contents">
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                {crumb.isLast ? (
                                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link to={crumb.path} className="hover:text-primary transition-colors">
                                            {crumb.label}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </span>
                    ))}
                </BreadcrumbList>
            </Breadcrumb>
        </div>
    )
}
