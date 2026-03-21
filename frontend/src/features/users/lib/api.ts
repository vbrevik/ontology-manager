import { getCsrfToken } from '@/features/auth/lib/auth'

export interface User {
    id: string;
    username: string;
    email: string;
    created_at: string;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const csrfToken = getCsrfToken()
    const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || '',
            ...options.headers,
        },
    })

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || `Request failed (${res.status})`)
    }

    if (res.status === 204) {
        return null
    }

    return res.json()
}

export async function getUsers(params?: { page?: number, limit?: number }): Promise<{ users: User[], total: number }> {
    try {
        const data = await fetchWithAuth('/api/users') as User[];
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
    await fetchWithAuth(`/api/abac/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ role_id: input.roleId }),
    });
}

export async function removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    // Note: This API might vary depending on whether we use assignment ID or role ID
    // For now, mirroring what Matrix.tsx expects
    await fetchWithAuth(`/api/abac/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
}
