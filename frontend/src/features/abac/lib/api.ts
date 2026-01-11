
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
    }
};
