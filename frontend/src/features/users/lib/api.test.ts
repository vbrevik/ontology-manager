import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUsers, assignRoleToUser, removeRoleFromUser } from './api';

// Mock global fetch
global.fetch = vi.fn();

describe('User Management API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getUsers', () => {
        it('should fetch users successfully', async () => {
            const mockUsers = [
                { id: '1', username: 'testuser', email: 'test@example.com', created_at: '2024-01-01' },
                { id: '2', username: 'admin', email: 'admin@example.com', created_at: '2024-01-02' },
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockUsers,
            });

            const result = await getUsers();

            expect(global.fetch).toHaveBeenCalledWith('/api/users');
            expect(result.users).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.users[0].username).toBe('testuser');
        });

        it('should handle pagination', async () => {
            const mockUsers = Array.from({ length: 25 }, (_, i) => ({
                id: `${i}`,
                username: `user${i}`,
                email: `user${i}@example.com`,
                created_at: '2024-01-01',
            }));

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockUsers,
            });

            const result = await getUsers({ page: 2, limit: 10 });

            expect(result.users).toHaveLength(10);
            expect(result.users[0].username).toBe('user10');
            expect(result.total).toBe(25);
        });

        it('should fallback to mock data on error', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            const result = await getUsers();

            expect(result.users).toHaveLength(3);
            expect(result.users[0].username).toBe('admin');
            expect(result.total).toBe(3);
        });

        it('should fallback to mock data when response is not ok', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await getUsers();

            expect(result.users).toHaveLength(3);
            expect(result.total).toBe(3);
        });
    });

    describe('assignRoleToUser', () => {
        it('should assign role successfully', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
            });

            await assignRoleToUser('user-123', { roleId: 'role-456' });

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/abac/users/user-123/roles',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role_id: 'role-456' }),
                }
            );
        });

        it('should throw error when assignment fails', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 400,
            });

            await expect(
                assignRoleToUser('user-123', { roleId: 'role-456' })
            ).rejects.toThrow('Failed to assign role');
        });
    });

    describe('removeRoleFromUser', () => {
        it('should remove role successfully', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
            });

            await removeRoleFromUser('user-123', 'role-456');

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/abac/users/user-123/roles/role-456',
                {
                    method: 'DELETE',
                }
            );
        });

        it('should throw error when removal fails', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            await expect(
                removeRoleFromUser('user-123', 'role-456')
            ).rejects.toThrow('Failed to remove role');
        });
    });
});
