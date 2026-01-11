
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
    try {
        const res = await fetch('/api/rebac/permission-types');
        if (!res.ok) throw new Error('Failed to fetch permission types');
        return await res.json();
    } catch (e) {
        console.warn('Backend permission-types API not available, using mock data.');
        return [
            { id: 'pt1', name: 'READ_SENSITIVE', description: 'Can read sensitive data', level: 80, created_at: new Date().toISOString() },
            { id: 'pt2', name: 'EDIT_CONTENT', description: 'Can edit content', level: 50, created_at: new Date().toISOString() },
            { id: 'pt3', name: 'VIEW_PUBLIC', description: 'Can view public data', level: 10, created_at: new Date().toISOString() },
            { id: 'pt4', name: 'DELETE_RECORDS', description: 'Can delete records', level: 90, created_at: new Date().toISOString() }
        ];
    }
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
    try {
        const res = await fetch('/api/abac/roles'); // Reusing existing role endpoint
        if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status} ${res.statusText}`);
        return await res.json();
    } catch (e) {
        console.error('Fetch Roles Error:', e);
        console.warn('Backend roles API not available, using mock data.');
        return [
            { id: 'r1', name: 'Admin', description: 'System Administrator', created_at: new Date().toISOString() },
            { id: 'r2', name: 'Editor', description: 'Content Editor', created_at: new Date().toISOString() },
            { id: 'r3', name: 'Viewer', description: 'ReadOnly User', created_at: new Date().toISOString() }
        ];
    }
}

export async function fetchRolePermissionMappings(roleId: string): Promise<RolePermissionMapping[]> {
    try {
        const res = await fetch(`/api/rebac/roles/${roleId}/permission-mappings`);
        if (!res.ok) throw new Error(`Failed to fetch role permission mappings: ${res.status} ${res.statusText}`);
        return await res.json();
    } catch (e) {
        console.error('Fetch Role Mappings Error:', e);
        console.warn('Backend role-permission-mappings API not available, using mock data.');
        // Return some random mappings for demo
        if (roleId === 'r1') { // Admin
            return [
                { id: 'm1', role_id: roleId, permission_type_id: 'pt1', created_at: new Date().toISOString() },
                { id: 'm2', role_id: roleId, permission_type_id: 'pt4', created_at: new Date().toISOString() }
            ];
        }
        return [];
    }
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
    if (!res.ok) throw new Error('Failed to fetch classes');
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
    if (!res.ok) throw new Error('Failed to fetch entities');
    return res.json();
}

export interface EntityNode {
    id: string;
    class_id: string;
    display_name: string;
    parent_entity_id?: string;
    path_to_root: string;
    depth: number;
}

export async function fetchEntityDescendants(id: string): Promise<EntityNode[]> {
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
    try {
        const res = await fetch('/api/rebac/matrix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_ids: userIds })
        });
        if (!res.ok) throw new Error('Failed to fetch matrix');
        return await res.json();
    } catch (e) {
        console.warn('Backend matrix API not available, using mock data.');
        return userIds.reduce((acc, id) => ({ ...acc, [id]: [] }), {});
    }
}
