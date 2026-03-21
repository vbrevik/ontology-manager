import { describe, it, expect } from 'vitest';
import { evaluatePermission, type PermissionEvaluationContext } from './permissionEngine';

describe('permissionEngine', () => {
    const mockContext: PermissionEvaluationContext = {
        selectedRoleId: 'role-1',
        matrix: [
            { role_id: 'role-1', role_name: 'Editor', permissions: ['READ'] }
        ],
        overrides: [],
        hierarchy: {
            'task-1': 'project-1',
            'task-2': 'project-1',
            'subtask-1': 'task-1'
        }
    };

    it('should grant access if role has global permission in matrix', () => {
        const result = evaluatePermission('project-1', 'READ', mockContext);
        expect(result.status).toBe('granted');
        expect(result.trace[0].step).toBe('Global Role Matrix');
    });

    it('should return inherited if no rules apply', () => {
        const result = evaluatePermission('project-1', 'WRITE', mockContext);
        expect(result.status).toBe('inherited');
        expect(result.trace.find(t => t.resolvedStatus === 'inherited')).toBeDefined();
    });

    it('should respect direct ALLOW override', () => {
        const contextWithOverride = {
            ...mockContext,
            overrides: [
                {
                    source_entity_id: 'role-1',
                    target_entity_id: 'project-1',
                    relationship_type: 'GRANTS_ACCESS',
                    metadata: { action: 'WRITE', effect: 'ALLOW' }
                } as any
            ]
        };
        const result = evaluatePermission('project-1', 'WRITE', contextWithOverride);
        expect(result.status).toBe('granted');
        expect(result.trace[0].step).toBe('Direct Override');
    });

    it('should respect direct DENY override (Deny beats Global Grant)', () => {
        const contextWithOverride = {
            ...mockContext,
            overrides: [
                {
                    source_entity_id: 'role-1',
                    target_entity_id: 'project-1',
                    relationship_type: 'GRANTS_ACCESS',
                    metadata: { action: 'READ', effect: 'DENY' }
                } as any
            ]
        };
        const result = evaluatePermission('project-1', 'READ', contextWithOverride);
        expect(result.status).toBe('denied');
        expect(result.trace[0].step).toBe('Direct Override');
    });

    it('should inherit permission from parent', () => {
        const contextWithParentOverride = {
            ...mockContext,
            overrides: [
                {
                    source_entity_id: 'role-1',
                    target_entity_id: 'project-1',
                    relationship_type: 'GRANTS_ACCESS',
                    metadata: { action: 'WRITE', effect: 'ALLOW' }
                } as any
            ]
        };
        const result = evaluatePermission('task-1', 'WRITE', contextWithParentOverride);
        expect(result.status).toBe('granted');
        expect(result.trace.find(t => t.step === 'Inherited Override')).toBeDefined();
    });

    it('should allow deeper inheritance (Grandparent)', () => {
        const contextWithGrandParentOverride = {
            ...mockContext,
            overrides: [
                {
                    source_entity_id: 'role-1',
                    target_entity_id: 'project-1',
                    relationship_type: 'GRANTS_ACCESS',
                    metadata: { action: 'WRITE', effect: 'ALLOW' }
                } as any
            ]
        };
        const result = evaluatePermission('subtask-1', 'WRITE', contextWithGrandParentOverride);
        expect(result.status).toBe('granted');
        expect(result.trace.some(t => t.reason.includes('project-1'))).toBe(true);
    });

    it('should respect local override over inherited permission', () => {
        const contextWithConflict = {
            ...mockContext,
            overrides: [
                {
                    source_entity_id: 'role-1',
                    target_entity_id: 'project-1',
                    relationship_type: 'GRANTS_ACCESS',
                    metadata: { action: 'WRITE', effect: 'ALLOW' }
                } as any,
                {
                    source_entity_id: 'role-1',
                    target_entity_id: 'task-1',
                    relationship_type: 'GRANTS_ACCESS',
                    metadata: { action: 'WRITE', effect: 'DENY' }
                } as any
            ]
        };
        const result = evaluatePermission('task-1', 'WRITE', contextWithConflict);
        expect(result.status).toBe('denied');
        expect(result.trace[0].step).toBe('Direct Override');
    });
});
