import type { ReactNode } from 'react';
import { useAbac } from '@/features/abac/lib/abac';

interface RoleGuardProps {
    action?: string;
    roleName?: string;
    resourceId?: string | null;
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on ABAC permissions
 * 
 * Usage:
 * ```tsx
 * <RoleGuard action="write" resourceId={projectId}>
 *   <Button>Edit Project</Button>
 * </RoleGuard>
 * 
 * <RoleGuard roleName="admin">
 *   <AdminPanel />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({ action, roleName, resourceId, children, fallback = null }: RoleGuardProps) {
    const { hasPermission, hasRole } = useAbac();

    let hasAccess = false;

    if (action) {
        hasAccess = hasPermission(action, resourceId);
    } else if (roleName) {
        hasAccess = hasRole(roleName, resourceId);
    }

    return hasAccess ? <>{children}</> : <>{fallback}</>;
}
