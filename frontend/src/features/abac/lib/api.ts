
// ABAC API Client methods

export interface Role {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
}

export interface Resource {
    id: string;
    name: string;
    resource_type: string;
    created_at: string;
}

export interface Permission {
    id: string;
    role_id: string;
    action: string;
    created_at: string;
}

export interface UserRoleAssignment {
    id: string;
    user_id: string;
    role_name: string;
    resource_id: string | null;
    resource_name: string | null;
}

export const abacApi = {
    // Roles
    listRoles: async (): Promise<Role[]> => {
        const response = await fetch('/api/abac/roles', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch roles');
        return response.json();
    },

    createRole: async (name: string, description?: string): Promise<Role> => {
        const response = await fetch('/api/abac/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to create role');
        return response.json();
    },

    // Resources
    listResources: async (): Promise<Resource[]> => {
        const response = await fetch('/api/abac/resources', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch resources');
        return response.json();
    },

    createResource: async (name: string, resource_type: string): Promise<Resource> => {
        const response = await fetch('/api/abac/resources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, resource_type }),
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to create resource');
        return response.json();
    },

    // Permissions
    getRolePermissions: async (roleId: string): Promise<Permission[]> => {
        const response = await fetch(`/api/abac/permissions/${roleId}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch permissions');
        return response.json();
    },

    addPermission: async (roleId: string, action: string): Promise<Permission> => {
        const response = await fetch(`/api/abac/permissions/${roleId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to add permission');
        return response.json();
    },

    removePermission: async (permissionId: string): Promise<void> => {
        const response = await fetch(`/api/abac/permissions/${permissionId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to remove permission');
    },

    // User Roles
    getUserRoles: async (userId: string): Promise<UserRoleAssignment[]> => {
        const response = await fetch(`/api/abac/users/${userId}/roles`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch user roles');
        return response.json();
    },

    assignRole: async (userId: string, roleName: string, resourceId?: string | null): Promise<UserRoleAssignment> => {
        const response = await fetch(`/api/abac/users/${userId}/roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role_name: roleName, resource_id: resourceId }),
            credentials: 'include'
        });
        if (!response.ok) {
            try {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to assign role');
            } catch (e: any) {
                throw new Error(e.message || 'Failed to assign role');
            }
        }
        return response.json();
    },


    removeRole: async (assignmentId: string): Promise<void> => {
        const response = await fetch(`/api/abac/users/roles/${assignmentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to remove role assignment');
    },

    // Matrix
    getRolePermissionMatrix: async (): Promise<RolePermissionMatrix> => {
        const response = await fetch('/api/rebac/matrix/roles', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch permission matrix');
        return response.json();
    },

    batchUpdateRolePermissions: async (updates: RolePermissionUpdate[]): Promise<void> => {
        const response = await fetch('/api/rebac/matrix/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates }),
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to update permissions');
    },

    // Impact Analysis
    simulateRoleChange: async (input: SimulateRoleChangeInput): Promise<ImpactReport> => {
        const response = await fetch('/api/rebac/impact/simulate-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to simulate role change');
        return response.json();
    },

    updateRoleSchedule: async (assignmentId: string, data: UpdateScheduleRequest): Promise<void> => {
        const response = await fetch(`/api/rebac/users/roles/${assignmentId}/schedule`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to update schedule');
    }
};

export interface RolePermissionMatrix {
    roles: RolePermissionMatrixEntry[];
    permission_types: PermissionType[];
}

export interface RolePermissionMatrixEntry {
    role_id: string;
    role_name: string;
    permissions: string[];
}

export interface PermissionType {
    id: string;
    name: string;
    description?: string;
    level: number;
}


export interface RolePermissionUpdate {
    role_id: string;
    permission: string;
    grant: boolean;
}

export interface UserImpact {
    user_id: string;
    display_name?: string;
    email?: string;
    details: string;
}

export interface ImpactReport {
    affected_users_count: number;
    gained_access: UserImpact[];
    lost_access: UserImpact[];
}

export interface SimulateRoleChangeInput {
    role_id: string;
    added_permissions: string[];
    removed_permissions: string[];
}

export interface UpdateScheduleRequest {
    schedule_cron?: string;
    valid_from?: string; // ISO string
    valid_until?: string; // ISO string
}

