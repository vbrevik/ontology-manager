import type { RolePermissionMatrixEntry } from '@/features/abac/lib/api';
import type { Relationship } from '@/features/ontology/lib/api';

export type AccessStatus = 'granted' | 'denied' | 'inherited';

export interface PermissionEvaluationContext {
    selectedRoleId?: string;
    matrix: RolePermissionMatrixEntry[];
    overrides: Relationship[]; // Relationships of type 'GRANTS_ACCESS'
    hierarchy: Record<string, string>; // childId -> parentId
}

export interface EvaluationResult {
    status: AccessStatus;
    trace: {
        step: string;
        resolvedStatus: AccessStatus;
        reason: string;
    }[];
}

/**
 * Evaluates the effective permission for a given role, entity, and action.
 * Logic Hierarchy:
 * 1. Explicit Override on the Entity (Direct)
 * 2. Role-level Global Permission (Matrix)
 * 3. Inherited Overrides from Ancestors (Recursively)
 */
export function evaluatePermission(
    entityId: string,
    action: string,
    context: PermissionEvaluationContext,
    fieldName?: string
): EvaluationResult {
    const trace: EvaluationResult['trace'] = [];

    // 1. Check for Explicit Override on this specific Entity for this specific Role
    // If fieldName is provided, we check for field-specific first, then fall back to entity-level on same entity
    let directOverride = context.overrides.find(rel =>
        rel.source_entity_id === context.selectedRoleId &&
        rel.target_entity_id === entityId &&
        rel.metadata?.action === action &&
        rel.metadata?.field_name === fieldName
    );

    if (!directOverride && fieldName) {
        // Fallback to entity-level override on the same entity
        directOverride = context.overrides.find(rel =>
            rel.source_entity_id === context.selectedRoleId &&
            rel.target_entity_id === entityId &&
            rel.metadata?.action === action &&
            !rel.metadata?.field_name
        );
    }

    if (directOverride) {
        const effect = directOverride.metadata?.effect === 'DENY' ? 'denied' : 'granted';
        const isField = directOverride.metadata?.field_name === fieldName;
        return {
            status: effect,
            trace: [{
                step: isField ? 'Direct Field Override' : 'Entity-level Override (Inherited by Field)',
                resolvedStatus: effect,
                reason: `Explicit ${effect.toUpperCase()} found on this ${isField ? 'field' : 'resource'} for the selected role.`
            }]
        };
    }

    // 2. Check Role-level Global Permission (Matrix)
    // NOTE: This only applies if we aren't found in a direct override.
    const roleEntry = context.matrix.find(r => r.role_id === context.selectedRoleId);
    if (roleEntry && roleEntry.permissions.includes(action) && !fieldName) {
        // If the matrix says "granted", it's a "Global Grant"
        trace.push({
            step: 'Global Role Matrix',
            resolvedStatus: 'granted',
            reason: `Role ${roleEntry.role_name} has global ${action} capability.`
        });
        // We don't return yet because an ancestor DENY might still be relevant?
        // Actually, usually Global Grant is the baseline. 
        // Let's assume Global Grant is the weakest grant, and overrides (including ancestor denies) beat it.
    }

    // 3. Hierarchy Traversal (Inheritance)
    let currentId = entityId;
    let parentId = context.hierarchy[currentId];

    while (parentId) {
        const parentOverride = context.overrides.find(rel =>
            rel.source_entity_id === context.selectedRoleId &&
            rel.target_entity_id === parentId &&
            rel.metadata?.action === action &&
            rel.metadata?.field_name === fieldName
        );

        if (parentOverride) {
            const effect = parentOverride.metadata?.effect === 'DENY' ? 'denied' : 'granted';
            return {
                status: effect,
                trace: [
                    ...trace,
                    {
                        step: 'Inherited Override',
                        resolvedStatus: effect,
                        reason: `Inherited ${effect.toUpperCase()} from parent ${parentId}.`
                    }
                ]
            };
        }

        currentId = parentId;
        parentId = context.hierarchy[currentId];
    }

    // Final result
    const status = trace.length > 0 ? 'granted' : 'inherited';
    return {
        status,
        trace: [
            ...trace,
            {
                step: 'Final Resolution',
                resolvedStatus: status,
                reason: status === 'inherited' ? 'No explicit or global rules found. Defaulting to system fallback.' : 'Access confirmed via global matrix.'
            }
        ]
    };
}
