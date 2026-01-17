
export interface PermissionType {
    id: string;
    name: string;
    description?: string;
    level: number;
    created_at: string;
}

export interface RelationshipType {
    id: string;
    name: string;
    description?: string;
    grants_permission_inheritance: boolean;
    created_at: string;
}

export interface CreateRelationshipTypeInput {
    name: string;
    description?: string;
    grants_permission_inheritance: boolean;
}

export interface UpdateRelationshipTypeInput {
    description?: string;
    grants_permission_inheritance?: boolean;
}

export interface CreatePermissionTypeInput {
    name: string;
    description?: string;
    level: number;
}

export interface UpdatePermissionTypeInput {
    description?: string;
    level?: number;
}

// Ontology Classes
export interface Class {
    id: string;
    name: string;
    description?: string;
    parent_class_id?: string;
    version_id: string;
    tenant_id?: string;
    is_abstract: boolean;
    attributes: Record<string, any>; // Simplified view of properties for explorer
    created_at: string;
}

export interface CreateClassInput {
    name: string;
    description?: string;
    parent_class_id?: string;
    version_id: string;
    is_abstract?: boolean;
}

export interface UpdateClassInput {
    description?: string;
    parent_class_id?: string;
    is_abstract?: boolean;
}

export interface Property {
    id: string;
    name: string;
    description?: string;
    class_id: string;
    data_type: string;
    is_required: boolean;
    is_unique: boolean;
    version_id: string;
    validation_rules: any;
}

export interface CreatePropertyInput {
    name: string;
    description?: string;
    class_id: string;
    data_type: string;
    is_required?: boolean;
    is_unique?: boolean;
    version_id: string;
    validation_rules?: any;
}

export interface UpdatePropertyInput {
    description?: string;
    data_type?: string;
    is_required?: boolean;
    is_unique?: boolean;
    validation_rules?: any;
}

export interface OntologyVersion {
    id: string;
    version: string;
    description?: string;
    is_current: boolean;
    created_at: string;
}

export interface CreateVersionInput {
    version: string;
    description?: string;
}

export async function fetchPermissionTypes(): Promise<PermissionType[]> {
    const res = await fetch('/api/rebac/permission-types');
    if (!res.ok) throw new Error('Failed to fetch permission types');
    return await res.json();
}

export async function fetchRelationshipTypes(): Promise<RelationshipType[]> {
    const res = await fetch('/api/rebac/relationship-types');
    if (!res.ok) throw new Error('Failed to fetch relationship types');
    return res.json();
}

export async function createRelationshipType(input: CreateRelationshipTypeInput): Promise<RelationshipType> {
    const res = await fetch('/api/rebac/relationship-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to create relationship type');
    return res.json();
}

export async function updateRelationshipType(id: string, input: UpdateRelationshipTypeInput): Promise<RelationshipType> {
    const res = await fetch(`/api/rebac/relationship-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to update relationship type');
    return res.json();
}

export async function deleteRelationshipType(id: string): Promise<void> {
    const res = await fetch(`/api/rebac/relationship-types/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete relationship type');
}

export async function createPermissionType(input: CreatePermissionTypeInput): Promise<PermissionType> {
    const res = await fetch('/api/rebac/permission-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to create permission type');
    return res.json();
}

export async function updatePermissionType(id: string, input: UpdatePermissionTypeInput): Promise<PermissionType> {
    const res = await fetch(`/api/rebac/permission-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to update permission type');
    return res.json();
}

export async function deletePermissionType(id: string): Promise<void> {
    const res = await fetch(`/api/rebac/permission-types/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete permission type');
}

// Roles API
export interface Role {
    id: string;
    name: string;
    description?: string;
    created_at: string;
}

export interface RolePermissionMapping {
    id: string;
    role_id: string;
    permission_type_id: string;
    field_name?: string;
    created_at: string;
}

export async function fetchRoles(): Promise<Role[]> {
    const res = await fetch('/api/abac/roles'); // Reusing existing role endpoint
    if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status} ${res.statusText}`);
    return await res.json();
}

export async function fetchRolePermissionMappings(roleId: string): Promise<RolePermissionMapping[]> {
    const res = await fetch(`/api/rebac/roles/${roleId}/permission-mappings`);
    if (!res.ok) throw new Error(`Failed to fetch role permission mappings: ${res.status} ${res.statusText}`);
    return await res.json();
}

export async function addRolePermission(roleId: string, permissionName: string, fieldName?: string): Promise<void> {
    const url = new URL(`/api/rebac/roles/${roleId}/permissions/${permissionName}`, window.location.origin);
    if (fieldName) url.searchParams.append('field_name', fieldName);

    const res = await fetch(url.toString(), {
        method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to add role permission');
}

export async function removeRolePermission(roleId: string, permissionName: string): Promise<void> {
    const res = await fetch(`/api/rebac/roles/${roleId}/permissions/${permissionName}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to remove role permission');
}

// Ontology Classes API
export async function fetchClasses(): Promise<Class[]> {
    const res = await fetch('/api/ontology/classes');
    return res.json();
}

export async function getClass(id: string): Promise<Class> {
    const res = await fetch(`/api/ontology/classes/${id}`);
    if (!res.ok) throw new Error('Failed to fetch class');
    return res.json();
}

export async function createClass(input: CreateClassInput): Promise<Class> {
    const res = await fetch('/api/ontology/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to create class');
    return res.json();
}

export async function updateClass(id: string, input: UpdateClassInput): Promise<Class> {
    const res = await fetch(`/api/ontology/classes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to update class');
    return res.json();
}

export async function deleteClass(id: string): Promise<void> {
    const res = await fetch(`/api/ontology/classes/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete class');
}

// Properties
export async function fetchProperties(classId: string): Promise<Property[]> {
    const res = await fetch(`/api/ontology/classes/${classId}/properties`);
    if (!res.ok) throw new Error('Failed to fetch properties');
    return res.json();
}

export async function createProperty(input: CreatePropertyInput): Promise<Property> {
    const res = await fetch('/api/ontology/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to create property');
    return res.json();
}

export async function updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
    const res = await fetch(`/api/ontology/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to update property');
    return res.json();
}

export async function deleteProperty(id: string): Promise<void> {
    const res = await fetch(`/api/ontology/properties/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete property');
}

// Versions
export async function fetchOntologyVersions(): Promise<OntologyVersion[]> {
    const res = await fetch('/api/ontology/versions');
    if (!res.ok) throw new Error('Failed to fetch ontology versions');
    return res.json();
}

export async function fetchCurrentVersion(): Promise<OntologyVersion> {
    const res = await fetch('/api/ontology/versions/current');
    if (!res.ok) throw new Error('Failed to fetch current version');
    return res.json();
}

export async function createOntologyVersion(input: CreateVersionInput): Promise<OntologyVersion> {
    const res = await fetch('/api/ontology/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to create ontology version');
    return res.json();
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Entity {
    id: string;
    class_id: string;
    class_name: string;
    display_name: string;
    parent_entity_id?: string;
    parent_entity_name?: string;
    tenant_id?: string;
    attributes: Record<string, any>;
    approval_status: ApprovalStatus;
    approved_by?: string;
    approved_at?: string;
    created_at: string;
    updated_at: string;
}

export interface FetchEntitiesQuery {
    class_id?: string;
    tenant_id?: string;
    is_root?: boolean;
}


export interface CreateEntityInput {
    class_id: string;
    display_name: string;
    parent_entity_id?: string;
    attributes?: Record<string, any>;
}

export interface UpdateEntityInput {
    display_name?: string;
    parent_entity_id?: string;
    attributes?: Record<string, any>;
}

export async function createEntity(input: CreateEntityInput): Promise<Entity> {
    const res = await fetch('/api/ontology/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to create entity');
    return res.json();
}

export async function updateEntity(id: string, input: UpdateEntityInput): Promise<Entity> {
    const res = await fetch(`/api/ontology/entities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to update entity');
    return res.json();
}

export async function deleteEntity(id: string): Promise<void> {
    const res = await fetch(`/api/ontology/entities/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete entity');
}

export async function approveEntity(id: string): Promise<Entity> {
    const res = await fetch(`/api/ontology/entities/${id}/approve`, {
        method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to approve entity');
    return res.json();
}

export async function rejectEntity(id: string): Promise<Entity> {
    const res = await fetch(`/api/ontology/entities/${id}/reject`, {
        method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to reject entity');
    return res.json();
}

export async function fetchEntities(query?: FetchEntitiesQuery): Promise<Entity[]> {
    const params = new URLSearchParams();
    if (query?.class_id) params.append('class_id', query.class_id);
    if (query?.tenant_id) params.append('tenant_id', query.tenant_id);
    if (query?.is_root !== undefined) params.append('is_root', String(query.is_root));

    const res = await fetch(`/api/ontology/entities?${params.toString()}`);
    return res.json();
}

export async function getEntity(id: string): Promise<Entity> {
    const res = await fetch(`/api/ontology/entities/${id}`);
    if (!res.ok) throw new Error('Failed to fetch entity');
    return res.json();
}

export interface EntityDescendant {
    descendant_id: string;
    descendant_name: string;
    depth: number;
}

export async function fetchEntityDescendants(id: string): Promise<EntityDescendant[]> {
    const res = await fetch(`/api/ontology/entities/${id}/descendants`);
    if (!res.ok) throw new Error('Failed to fetch entity descendants');
    return res.json();
}

export interface RelationshipWithDetails {
    id: string;
    source_entity_id: string;
    source_entity_name: string;
    target_entity_id: string;
    target_entity_name: string;
    relationship_type_id: string;
    relationship_type_name: string;
    metadata: any;
    created_at: string;
}

export async function fetchEntityRelationships(id: string): Promise<RelationshipWithDetails[]> {
    const res = await fetch(`/api/ontology/entities/${id}/relationships?direction=both`);
    if (!res.ok) throw new Error('Failed to fetch entity relationships');
    return res.json();
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

export async function simulateRoleChange(input: SimulateRoleChangeInput): Promise<ImpactReport> {
    const res = await fetch('/api/rebac/impact/simulate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to simulate role change');
    return res.json();
}

export interface CreateRelationshipInput {
    source_entity_id: string;
    target_entity_id: string;
    relationship_type: string;
    metadata?: any;
}

export interface Relationship {
    id: string;
    source_entity_id: string;
    target_entity_id: string;
    relationship_type_id: string;
    metadata?: any;
    created_at: string;
}

export async function createRelationship(input: CreateRelationshipInput): Promise<Relationship> {
    const res = await fetch('/api/ontology/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Failed to create relationship');
    return res.json();
}

export async function deleteRelationship(id: string): Promise<void> {
    const res = await fetch(`/api/ontology/relationships/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete relationship');
}
export async function fetchAccessMatrix(userIds: string[]): Promise<Record<string, string[]>> {
    const res = await fetch('/api/rebac/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds })
    });
    if (!res.ok) throw new Error('Failed to fetch matrix');
    return await res.json();
}
// AI Suggestions
export async function suggestOntology(context: string): Promise<any[]> {
    const res = await fetch('/api/ai/suggest-ontology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
    });
    if (!res.ok) throw new Error('Failed to suggest ontology');
    return res.json();
}

export async function suggestRoles(context: string): Promise<any[]> {
    const res = await fetch('/api/ai/suggest-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
    });
    if (!res.ok) throw new Error('Failed to suggest roles');
    return res.json();
}

export async function suggestContexts(context: string): Promise<any[]> {
    const res = await fetch('/api/ai/suggest-contexts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
    });
    if (!res.ok) throw new Error('Failed to suggest contexts');
    return res.json();
}

export async function fetchAiStatus(): Promise<{ status: string; model?: string; provider_url?: string; message?: string }> {
    const res = await fetch('/api/ai/status');
    if (!res.ok) throw new Error('Failed to fetch AI status');
    return res.json();
}

export async function fetchAiModels(): Promise<string[]> {
    const res = await fetch('/api/ai/models');
    if (!res.ok) throw new Error('Failed to fetch AI models');
    return res.json();
}
// Delegation Rules
export interface DelegationRule {
    id: string;
    granter_role_id: string;
    grantee_role_id: string;
    can_grant: boolean;
    can_modify: boolean;
    can_revoke: boolean;
    tenant_id?: string;
    created_at: string;
}

export interface CreateDelegationRuleInput {
    granter_role_id: string;
    grantee_role_id: string;
    can_grant: boolean;
    can_modify: boolean;
    can_revoke: boolean;
    tenant_id?: string;
}

export async function fetchDelegationRules(): Promise<DelegationRule[]> {
    const res = await fetch('/api/rebac/delegation-rules', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch delegation rules');
    return res.json();
}

export async function createDelegationRule(input: CreateDelegationRuleInput): Promise<DelegationRule> {
    const res = await fetch('/api/rebac/delegation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to create delegation rule');
    return res.json();
}

export async function removeDelegationRule(id: string): Promise<void> {
    const res = await fetch(`/api/rebac/delegation-rules/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to remove delegation rule');
}

// Policy Engine Types
export interface Condition {
    attribute: string;
    operator: string;
    value: any;
}

export interface ConditionGroup {
    all: Condition[];
    any: Condition[];
}

export interface EvaluationContext {
    entity: Record<string, any>;
    user: Record<string, any>;
    env: Record<string, any>;
    request: Record<string, any>;
}

export interface CreatePolicyInput {
    name: string;
    description?: string;
    effect: string;
    priority?: number;
    target_class_id?: string;
    target_permissions: string[];
    conditions: ConditionGroup;
    scope_entity_id?: string;
    is_active?: boolean;
    valid_from?: string;
    valid_until?: string;
}

export interface TestPolicyRequest {
    policy: CreatePolicyInput;
    context: EvaluationContext;
    permission: string;
}

export interface ConditionTestResult {
    attribute: string;
    operator: string;
    expected_value: any;
    actual_value?: any;
    passed: boolean;
}

export interface TestPolicyResponse {
    would_match: boolean;
    effect: string;
    condition_results: ConditionTestResult[];
}

export async function testPolicy(request: TestPolicyRequest): Promise<TestPolicyResponse> {
    const res = await fetch('/api/rebac/policies/test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error('Failed to test policy');
    return res.json();
}
