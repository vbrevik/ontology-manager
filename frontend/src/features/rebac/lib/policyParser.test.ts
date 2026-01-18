import { describe, it, expect } from 'vitest';
import { parsePolicy } from './policyParser';

describe('Policy Parser', () => {
    it('should parse simple allow rule with equality', () => {
        const policy = 'allow if user.role == "admin"';
        const result = parsePolicy(policy);

        expect(result).toHaveLength(1);
        expect(result[0].effect).toBe('ALLOW');
        expect(result[0].conditions.all).toHaveLength(1);
        expect(result[0].conditions.all[0]).toEqual({
            attribute: 'user.role',
            operator: '==',
            value: 'admin',
        });
    });

    it('should parse allow rule with numeric comparison', () => {
        const policy = 'allow if user.score > 5';
        const result = parsePolicy(policy);

        expect(result[0].conditions.all[0]).toEqual({
            attribute: 'user.score',
            operator: '>',
            value: 5,
        });
    });

    it('should parse allow rule with array value (in operator)', () => {
        const policy = 'allow if resource.status in ["active", "pending"]';
        const result = parsePolicy(policy);

        expect(result[0].conditions.all[0]).toEqual({
            attribute: 'resource.status',
            operator: 'in',
            value: ['active', 'pending'],
        });
    });

    it('should parse multiple conditions with AND', () => {
        const policy = 'allow if user.role == "editor" and resource.status == "draft"';
        const result = parsePolicy(policy);

        expect(result).toHaveLength(1);
        expect(result[0].conditions.all).toHaveLength(2);
        expect(result[0].conditions.all[0]).toEqual({
            attribute: 'user.role',
            operator: '==',
            value: 'editor',
        });
        expect(result[0].conditions.all[1]).toEqual({
            attribute: 'resource.status',
            operator: '==',
            value: 'draft',
        });
    });

    it('should parse boolean values', () => {
        const policy = 'allow if user.verified == true';
        const result = parsePolicy(policy);

        expect(result[0].conditions.all[0].value).toBe(true);
    });

    it('should parse multiple allow rules on separate lines', () => {
        const policy = `allow if user.role == "admin"
allow if user.role == "owner"`;
        const result = parsePolicy(policy);

        expect(result).toHaveLength(2);
        expect(result[0].conditions.all[0].value).toBe('admin');
        expect(result[1].conditions.all[0].value).toBe('owner');
    });

    it('should ignore comment lines', () => {
        const policy = `// This is a comment
allow if user.role == "admin"
// Another comment`;
        const result = parsePolicy(policy);

        expect(result).toHaveLength(1);
    });

    it('should ignore explicit deny lines', () => {
        const policy = `allow if user.role == "admin"
deny`;
        const result = parsePolicy(policy);

        expect(result).toHaveLength(1);
    });

    it('should ignore empty lines', () => {
        const policy = `
allow if user.role == "admin"

allow if user.score > 10
`;
        const result = parsePolicy(policy);

        expect(result).toHaveLength(2);
    });

    it('should handle all comparison operators', () => {
        const policies = [
            { text: 'allow if x == 1', op: '==' },
            { text: 'allow if x != 1', op: '!=' },
            { text: 'allow if x > 1', op: '>' },
            { text: 'allow if x < 1', op: '<' },
            { text: 'allow if x >= 1', op: '>=' },
            { text: 'allow if x <= 1', op: '<=' },
            { text: 'allow if x in [1, 2]', op: 'in' },
            { text: 'allow if x not_in [1, 2]', op: 'not_in' },
        ];

        policies.forEach(({ text, op }) => {
            const result = parsePolicy(text);
            expect(result[0].conditions.all[0].operator).toBe(op);
        });
    });

    it('should handle dotted attribute paths', () => {
        const policy = 'allow if user.profile.subscription.tier == "premium"';
        const result = parsePolicy(policy);

        expect(result[0].conditions.all[0]).toEqual({
            attribute: 'user.profile.subscription.tier',
            operator: '==',
            value: 'premium',
        });
    });

    it('should return empty array for invalid syntax', () => {
        const policy = 'invalid syntax here';
        const result = parsePolicy(policy);

        expect(result).toHaveLength(0);
    });

    it('should handle numeric arrays', () => {
        const policy = 'allow if user.permissions in [1, 2, 3]';
        const result = parsePolicy(policy);

        expect(result[0].conditions.all[0].value).toEqual([1, 2, 3]);
    });

    it('should create proper condition groups', () => {
        const policy = 'allow if user.role == "admin"';
        const result = parsePolicy(policy);

        expect(result[0].conditions).toHaveProperty('all');
        expect(result[0].conditions).toHaveProperty('any');
        expect(result[0].conditions.any).toEqual([]);
    });
});
