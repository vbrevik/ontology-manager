export interface User {
    id: string;
    username: string;
    email: string;
    created_at: string;
}

export async function getUsers(params?: { page?: number, limit?: number }): Promise<{ users: User[], total: number }> {
    try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        // Simple pagination mock if backend doesn't support it yet
        const limit = params?.limit || 10;
        const page = params?.page || 1;
        return {
            users: data.slice((page - 1) * limit, page * limit),
            total: data.length
        };
    } catch (e) {
        console.warn('Backend users API not available, using mock data.');
        return {
            users: [
                { id: 'u1', username: 'admin', email: 'admin@example.com', created_at: new Date().toISOString() },
                { id: 'u2', username: 'editor', email: 'editor@example.com', created_at: new Date().toISOString() },
                { id: 'u3', username: 'viewer', email: 'viewer@example.com', created_at: new Date().toISOString() }
            ],
            total: 3
        };
    }
}

export async function assignRoleToUser(userId: string, input: { roleId: string }): Promise<void> {
    const res = await fetch(`/api/abac/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: input.roleId })
    });
    if (!res.ok) throw new Error('Failed to assign role');
}

export async function removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    // Note: This API might vary depending on whether we use assignment ID or role ID
    // For now, mirroring what Matrix.tsx expects
    const res = await fetch(`/api/abac/users/${userId}/roles/${roleId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to remove role');
}
