import { useAuth } from '@/features/auth/lib/context';

export interface UserRoleClaim {
    role_name: string;
    resource_id: string | null;
}

/**
 * Hook to check if the current user has a specific permission
 * @param action - The permission action (e.g., 'read', 'write', 'delete')
 * @param resourceId - Optional resource ID to check scoped permissions
 * @returns true if the user has the permission, false otherwise
 */
export function useAbac() {
    const { user } = useAuth();

    const hasPermission = (action: string, resourceId?: string | null): boolean => {
        if (!user || !user.roles) return false;

        // Check if user has a role that grants the permission
        return user.roles.some((role: UserRoleClaim) => {
            // If resource-specific permission is requested, match resource_id
            if (resourceId !== undefined) {
                // Global roles (resource_id === null) grant access everywhere
                if (role.resource_id === null) {
                    return canRolePerformAction(role.role_name, action);
                }
                // Resource-scoped roles only grant access to that specific resource
                if (role.resource_id === resourceId) {
                    return canRolePerformAction(role.role_name, action);
                }
                return false;
            }

            // If no specific resource requested, check if role grants the action
            return canRolePerformAction(role.role_name, action);
        });
    };

    const hasRole = (roleName: string, resourceId?: string | null): boolean => {
        if (!user || !user.roles) return false;

        return user.roles.some((role: UserRoleClaim) => {
            if (role.role_name !== roleName) return false;

            if (resourceId !== undefined) {
                return role.resource_id === null || role.resource_id === resourceId;
            }

            return true;
        });
    };

    return { hasPermission, hasRole, roles: user?.roles || [] };
}

/**
 * Helper to determine if a role can perform an action
 * This mirrors the backend's permission logic
 */
function canRolePerformAction(roleName: string, action: string): boolean {
    const rolePermissions: Record<string, string[]> = {
        superadmin: ['*'], // Wildcard grants all permissions
        admin: ['read', 'write', 'delete', 'manage_users'],
        editor: ['read', 'write'],
        viewer: ['read'],
    };

    const permissions = rolePermissions[roleName] || [];
    return permissions.includes('*') || permissions.includes(action);
}
