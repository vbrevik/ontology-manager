# Authorization Features (ABAC & ReBAC)

**Last Updated**: 2026-01-18  
**Status**: ✅ Implementation Complete | ⏳ Test Coverage Expansion

---

## 📋 Overview

The Ontology Manager implements a dual-authorization system combining Attribute-Based Access Control (ABAC) and Relationship-Based Access Control (ReBAC).

### Features Implemented
- ✅ ABAC schema & services
- ✅ ReBAC policy engine with condition evaluator
- ✅ Default roles seeded (Admin, User, Viewer)
- ✅ JWT includes user roles & permissions
- ✅ Frontend `useAbac()` & `RoleGuard` components
- ✅ Admin ABAC management UI
- ✅ Temporal/scoped role assignments
- ✅ Delegation control

---

## 🔐 ABAC (Attribute-Based Access Control)

### Concepts

**ABAC Model**:
- **Users**: Have roles and permissions
- **Roles**: Collections of permissions (e.g., `SuperAdmin`, `User`)
- **Permissions**: Granular actions on resources (e.g., `read:ontology_classes`)
- **Resources**: System entities (ontology classes, entities, policies)

### Default Roles

| Role | Permissions | Purpose |
|------|-------------|---------|
| `SuperAdmin` | All permissions | Full system access |
| `Admin` | Most permissions | Manage users & ontology |
| `User` | Basic permissions | Read/write own data |
| `Viewer` | Read-only | View-only access |

### Permission Structure

```rust
// Format: action:resource
Examples:
- "read:ontology_classes"
- "write:ontology_classes"
- "delete:ontology_classes"
- "manage:users"
- "audit:logs"
```

### Role Assignment

```sql
-- Temporal assignment (with expiry)
INSERT INTO user_roles (user_id, role_id, expires_at)
VALUES ($1, $2, $3);

-- Scoped assignment (limited to resource)
INSERT INTO user_roles (user_id, role_id, resource_id, scope_type)
VALUES ($1, $2, $3, 'ontology_class');
```

---

## 🔗 ReBAC (Relationship-Based Access Control)

### Concepts

**ReBAC Model**:
- **Entities**: Data objects (users, documents, projects)
- **Relationships**: Directed edges between entities (e.g., `owns`, `manages`)
- **Policies**: Rules based on relationship paths (e.g., "User can access documents owned by their department")

### Policy Structure

```json
{
  "policy_id": "policy_001",
  "name": "Department Document Access",
  "description": "Users can access documents owned by their department",
  "condition": {
    "type": "relationship_path",
    "path": ["User", "memberOf", "Department", "owns", "Document"],
    "permission": "read"
  }
}
```

### Policy Evaluation

```rust
// Example: Check if user can access document
fn evaluate_policy(user_id: Uuid, document_id: Uuid, permission: &str) -> bool {
    // Find policy with matching permission
    // Check if relationship path exists
    // Evaluate conditions (e.g., time constraints)
    // Return true/false
}
```

### Relationship Types

| Relationship | From | To | Description |
|--------------|------|-----|-------------|
| `memberOf` | User | Department | User belongs to department |
| `owns` | Department | Document | Department owns document |
| `manages` | User | Project | User manages project |
| `hasAccessTo` | User | Resource | Direct access grant |

---

## 🔌 API Integration

### JWT Claims

Access tokens include authorization context:

```json
{
  "sub": "user_id",
  "roles": [
    {
      "role_name": "Admin",
      "permissions": ["read:ontology_classes", "write:ontology_classes"]
    }
  ],
  "exp": 1234567890
}
```

### Middleware

```rust
// Check ABAC permission
#[axum::debug_handler]
async fn protected_route(
    Extension(claims): Extension<Claims>,
) -> Result<Json<Response>, Error> {
    // Automatically checks if user has required permission
    // Returns 403 if permission missing
}
```

### Frontend Integration

```typescript
// React component with ABAC guard
import { useAbac } from '@/features/auth/hooks/useAbac'

function AdminPanel() {
  const { hasPermission } = useAbac()
  
  if (!hasPermission('manage:users')) {
    return <AccessDenied />
  }
  
  return <AdminDashboard />
}
```

---

## 🎯 Admin ABAC Management

### Features

- **Role Management**: Create, update, delete roles
- **Permission Management**: Assign permissions to roles
- **User Assignment**: Assign roles to users
- **Policy Designer**: Visual policy creation (ReBAC)
- **Impact Analysis**: Simulate policy changes
- **Audit Logging**: Track authorization changes

### UI Routes

- `/admin/roles` - Role management
- `/admin/permissions` - Permission management
- `/admin/users` - User role assignment
- `/admin/policies` - ReBAC policy designer
- `/admin/impact-analysis` - Policy simulation

---

## 🧪 Testing

### Current Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| ABAC Service | 10 | 90% |
| ReBAC Service | 15 | 85% |
| **TOTAL** | **25** | **~87%** |

### ABAC Tests (10)

- Role creation & management
- Permission assignment
- User role assignment
- Temporal role assignments (expiry)
- Scoped role assignments (resource-limited)
- Delegation control
- Permission checking
- JWT claim generation
- Wildcard permissions
- Role hierarchy

### ReBAC Tests (15)

- Policy creation & evaluation
- Relationship path traversal
- Condition evaluation (time, attributes)
- Batch operations
- Caching effectiveness
- Complex relationship chains
- Negative cases (no relationship)
- Multiple policies (OR logic)
- Policy priority
- Performance testing

### Test Files

- `backend/tests/abac_test.rs` - ABAC service tests
- `backend/tests/rebac_test.rs` - ReBAC service tests
- `frontend/tests/ontology-roles.spec.ts` - E2E ABAC tests

---

## 📊 Authorization Flow

### Request Authorization

```
1. User makes request
   ↓
2. JWT validated (middleware)
   ↓
3. Claims extracted (roles, permissions)
   ↓
4. ABAC check (role has permission?)
   ↓
5. ReBAC check (relationship exists?)
   ↓
6. Allow access (200 OK) or Deny (403 Forbidden)
```

### Permission Check

```rust
// Backend permission check
fn check_permission(claims: &Claims, required_permission: &str) -> bool {
    claims.roles.iter().any(|role| {
        role.permissions.contains(&String::from(required_permission))
    })
}

// Frontend permission check
const hasPermission = (permission: string) => {
  return user?.roles?.some(role => 
    role.permissions.includes(permission)
  )
}
```

---

## 🔧 Database Schema

### ABAC Tables

```sql
-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,  -- "read:ontology_classes"
    description TEXT
);

-- Role-Permission Mapping
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- User-Role Assignment
CREATE TABLE user_roles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    expires_at TIMESTAMPTZ,  -- Temporal assignment
    resource_id UUID,        -- Scoped assignment
    scope_type TEXT,         -- "ontology_class", "project", etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### ReBAC Tables

```sql
-- Entities
CREATE TABLE rebac_entities (
    id UUID PRIMARY KEY,
    entity_type TEXT NOT NULL,  -- "User", "Department", "Document"
    entity_id UUID,            -- Reference to actual entity
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships
CREATE TABLE rebac_relationships (
    id UUID PRIMARY KEY,
    from_entity_id UUID REFERENCES rebac_entities(id),
    relationship_type TEXT NOT NULL,  -- "owns", "manages", "memberOf"
    to_entity_id UUID REFERENCES rebac_entities(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies
CREATE TABLE rebac_policies (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    condition JSONB NOT NULL,  -- Policy definition
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🚨 Security Considerations

### Authorization Bypass Prevention

- ✅ JWT validation on all protected routes
- ✅ Admin endpoints protected (CVE-001 fix)
- ✅ Role checks enforced server-side
- ✅ Frontend checks for UX only (never trust)
- ✅ Audit logging for authorization failures

### Privilege Escalation Prevention

- ✅ Users cannot assign themselves roles (requires Admin)
- ✅ Temporal assignments have expiry checks
- ✅ Scoped assignments limited to specific resources
- ✅ Policy changes require Admin approval
- ✅ Role hierarchy enforced

---

## 📚 API Endpoints

### ABAC

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/abac/roles` | Protected | List all roles |
| POST | `/api/abac/roles` | Admin | Create role |
| PUT | `/api/abac/roles/:id` | Admin | Update role |
| DELETE | `/api/abac/roles/:id` | Admin | Delete role |
| GET | `/api/abac/permissions` | Protected | List all permissions |
| POST | `/api/abac/user-roles` | Admin | Assign role to user |
| DELETE | `/api/abac/user-roles/:id` | Admin | Remove user role |

### ReBAC

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/rebac/policies` | Protected | List policies |
| POST | `/api/rebac/policies` | Admin | Create policy |
| PUT | `/api/rebac/policies/:id` | Admin | Update policy |
| DELETE | `/api/rebac/policies/:id` | Admin | Delete policy |
| POST | `/api/rebac/evaluate` | Protected | Evaluate policy |
| POST | `/api/rebac/simulate` | Admin | Simulate policy change |

---

## 🚀 Future Enhancements

### Planned
- [ ] Policy templates (common patterns)
- [ ] Role templates (default configurations)
- [ ] Advanced condition evaluation (AND/OR/NOT logic)
- [ ] Policy versioning
- [ ] Bulk user role assignments

### Considered
- [ ] Machine learning policy suggestions
- [ ] Just-in-time (JIT) authorization
- [ ] Dynamic policies (time-based, location-based)
- [ ] Delegation approval workflows

---

## 📖 References

### Documentation
- **STATUS.md**: Overall project status
- **docs/FEATURES_AUTH.md**: Authentication features

### Code Files
- `backend/src/features/abac/service.rs`: ABAC service logic
- `backend/src/features/abac/routes.rs`: ABAC API endpoints
- `backend/src/features/rebac/service.rs`: ReBAC policy engine
- `backend/src/features/rebac/routes.rs`: ReBAC API endpoints
- `frontend/src/features/auth/hooks/useAbac.ts`: Frontend ABAC hook
- `frontend/src/components/auth/RoleGuard.tsx`: Role guard component

---

**Feature Owner**: Backend Team  
**Status**: ✅ Implementation Complete | ⏳ Test Coverage Expansion  
**Next Review**: After test expansion (2026-01-22)
