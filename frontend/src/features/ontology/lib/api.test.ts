import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    fetchPermissionTypes,
    fetchRelationshipTypes,
    createRelationshipType,
    updateRelationshipType,
    deleteRelationshipType,
    createPermissionType,
    updatePermissionType,
    deletePermissionType,
    fetchRoles,
    fetchRolePermissionMappings,
    addRolePermission,
    removeRolePermission,
    fetchClasses,
    getClass,
    createClass,
    updateClass,
    deleteClass,
} from './api';

// Mock global fetch
global.fetch = vi.fn();

describe('Ontology API - Permission Types', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch permission types', async () => {
        const mockTypes = [
            { id: '1', name: 'read', description: 'Read permission', level: 1, created_at: '2024-01-01' },
            { id: '2', name: 'write', description: 'Write permission', level: 2, created_at: '2024-01-01' },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockTypes,
        });

        const result = await fetchPermissionTypes();

        expect(global.fetch).toHaveBeenCalledWith('/api/rebac/permission-types');
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('read');
    });

    it('should create permission type', async () => {
        const input = { name: 'execute', description: 'Execute permission', level: 3 };
        const mockResult = { id: '3', ...input, created_at: '2024-01-01' };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResult,
        });

        const result = await createPermissionType(input);

        expect(global.fetch).toHaveBeenCalledWith('/api/rebac/permission-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        expect(result.name).toBe('execute');
    });

    it('should update permission type', async () => {
        const input = { description: 'Updated description', level: 4 };
        const mockResult = { id: '1', name: 'read', ...input, created_at: '2024-01-01' };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResult,
        });

        const result = await updatePermissionType('1', input);

        expect(global.fetch).toHaveBeenCalledWith('/api/rebac/permission-types/1', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        expect(result.description).toBe('Updated description');
    });

    it('should delete permission type', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        await deletePermissionType('1');

        expect(global.fetch).toHaveBeenCalledWith('/api/rebac/permission-types/1', {
            method: 'DELETE',
        });
    });
});

describe('Ontology API - Relationship Types', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch relationship types', async () => {
        const mockTypes = [
            { id: '1', name: 'parent_of', description: 'Parent relationship', grants_permission_inheritance: true, created_at: '2024-01-01' },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockTypes,
        });

        const result = await fetchRelationshipTypes();

        expect(global.fetch).toHaveBeenCalledWith('/api/rebac/relationship-types');
        expect(result).toHaveLength(1);
        expect(result[0].grants_permission_inheritance).toBe(true);
    });

    it('should create relationship type', async () => {
        const input = { name: 'owns', description: 'Ownership', grants_permission_inheritance: false };
        const mockResult = { id: '2', ...input, created_at: '2024-01-01' };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResult,
        });

        const result = await createRelationshipType(input);

        expect(result.name).toBe('owns');
        expect(result.grants_permission_inheritance).toBe(false);
    });

    it('should update relationship type', async () => {
        const input = { description: 'Updated', grants_permission_inheritance: true };
        const mockResult = { id: '1', name: 'parent_of', ...input, created_at: '2024-01-01' };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResult,
        });

        const result = await updateRelationshipType('1', input);

        expect(result.grants_permission_inheritance).toBe(true);
    });

    it('should delete relationship type', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        await deleteRelationshipType('1');

        expect(global.fetch).toHaveBeenCalledWith('/api/rebac/relationship-types/1', {
            method: 'DELETE',
        });
    });
});

describe('Ontology API - Roles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch roles', async () => {
        const mockRoles = [
            { id: 'r1', name: 'admin', description: 'Admin role', created_at: '2024-01-01' },
            { id: 'r2', name: 'viewer', description: 'Viewer role', created_at: '2024-01-01' },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockRoles,
        });

        const result = await fetchRoles();

        expect(global.fetch).toHaveBeenCalledWith('/api/abac/roles');
        expect(result).toHaveLength(2);
    });

    it('should fetch role permission mappings', async () => {
        const mockMappings = [
            { id: 'm1', role_id: 'r1', permission_type_id: 'p1', field_name: 'name', created_at: '2024-01-01' },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockMappings,
        });

        const result = await fetchRolePermissionMappings('r1');

        expect(global.fetch).toHaveBeenCalledWith('/api/rebac/roles/r1/permission-mappings');
        expect(result).toHaveLength(1);
    });

    it('should add role permission', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        await addRolePermission('r1', 'read', 'email');

        // The implementation uses URL object, so we need to match the full URL
        const calls = (global.fetch as any).mock.calls;
        expect(calls[0][0]).toMatch(/\/api\/rebac\/roles\/r1\/permissions\/read\?field_name=email/);
        expect(calls[0][1]).toEqual({ method: 'POST' });
    });

    it('should remove role permission', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        await removeRolePermission('r1', 'write');

        expect(global.fetch).toHaveBeenCalledWith('/api/rebac/roles/r1/permissions/write', {
            method: 'DELETE',
        });
    });
});

describe('Ontology API - Classes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch classes', async () => {
        const mockClasses = [
            { id: 'c1', name: 'User', description: 'User class', parent_class_id: null, version_id: 'v1', tenant_id: 't1', is_abstract: false, attributes: {}, created_at: '2024-01-01' },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockClasses,
        });

        const result = await fetchClasses();

        expect(global.fetch).toHaveBeenCalledWith('/api/ontology/classes');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('User');
    });

    it('should get single class', async () => {
        const mockClass = {
            id: 'c1',
            name: 'User',
            description: 'User class',
            parent_class_id: null,
            version_id: 'v1',
            tenant_id: 't1',
            is_abstract: false,
            attributes: {},
            created_at: '2024-01-01',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockClass,
        });

        const result = await getClass('c1');

        expect(global.fetch).toHaveBeenCalledWith('/api/ontology/classes/c1');
        expect(result.name).toBe('User');
    });

    it('should create class', async () => {
        const input = {
            name: 'Project',
            description: 'Project class',
            version_id: 'v1',
            is_abstract: false,
        };
        const mockResult = { id: 'c2', ...input, parent_class_id: null, tenant_id: 't1', attributes: {}, created_at: '2024-01-01' };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResult,
        });

        const result = await createClass(input);

        expect(global.fetch).toHaveBeenCalledWith('/api/ontology/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        expect(result.name).toBe('Project');
    });

    it('should update class', async () => {
        const input = { description: 'Updated description' };
        const mockResult = {
            id: 'c1',
            name: 'User',
            ...input,
            parent_class_id: null,
            version_id: 'v1',
            tenant_id: 't1',
            is_abstract: false,
            attributes: {},
            created_at: '2024-01-01',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResult,
        });

        const result = await updateClass('c1', input);

        expect(result.description).toBe('Updated description');
    });

    it('should delete class', async () => {
        (global.fetch as any).mockResolvedValueOnce({ ok: true });

        await deleteClass('c1');

        expect(global.fetch).toHaveBeenCalledWith('/api/ontology/classes/c1', {
            method: 'DELETE',
        });
    });

    it('should handle fetch error', async () => {
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        await expect(fetchClasses()).rejects.toThrow('Network error');
    });

    it('should handle create error with status code', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
        });

        await expect(createClass({ name: 'Invalid', version_id: 'v1' })).rejects.toThrow();
    });
});
