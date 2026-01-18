# Test Data Marker System

## Overview

The Test Data Marker system provides an ontology-based solution for identifying and filtering test data from production views. This allows E2E tests to run safely even against production databases without polluting real user data.

## Architecture

### Ontology Structure

```
TestMarker (Class)
  ├── Properties:
  │   ├── test_suite: string - Name of test suite (e.g., "e2e", "integration")
  │   ├── test_run_id: string - Unique identifier for test run
  │   ├── created_by_test: string - Test name that created this entity
  │   └── expires_at: datetime - Auto-cleanup timestamp (optional)
  │
  └── Instance: "E2E Test Marker" (Singleton)
      └── ID: a1b2c3d4-e5f6-7890-abcd-900000000002

Relationship Type: "marked_as_test"
  ├── Source: Any Entity
  ├── Target: TestMarker (singleton)
  ├── Cardinality: many-to-one
  └── Purpose: Marks entity as test data
```

## Database Functions

### Core Functions

#### `is_test_data(entity_id UUID) → BOOLEAN`
Checks if an entity is marked as test data.

```sql
SELECT is_test_data('entity-uuid-here');
-- Returns: true if test data, false otherwise
```

#### `mark_as_test_data(entity_id UUID, test_suite VARCHAR, test_name VARCHAR)`
Marks an entity as test data.

```sql
SELECT mark_as_test_data(
  'entity-uuid-here',
  'e2e',
  'projects-test'
);
```

#### `get_non_test_entities(class_name VARCHAR) → TABLE(entity_id UUID)`
Returns all non-test entities of a given class.

```sql
SELECT * FROM get_non_test_entities('Project');
-- Returns only production projects
```

#### `cleanup_expired_test_data(days_old INTEGER) → TABLE(deleted_entity_id UUID, entity_type VARCHAR)`
Soft-deletes test entities older than specified days.

```sql
SELECT * FROM cleanup_expired_test_data(7);
-- Deletes test data older than 7 days
```

### Production Views

#### `production_projects`
Projects view with test data filtered out.

```sql
SELECT * FROM production_projects;
-- All projects except test data
```

#### `production_users`
Users view with test accounts filtered out.

```sql
SELECT * FROM production_users;
-- All users except test accounts
```

## Backend API

### Test Marker Service

```rust
use crate::features::test_marker::TestMarkerService;

let service = TestMarkerService::new(pool);

// Mark entity as test data
service.mark_as_test_data(entity_id, "e2e", Some("my-test")).await?;

// Check if entity is test data
let is_test = service.is_test_data(entity_id).await?;

// Cleanup old test data (admin only)
let deleted = service.cleanup_expired_test_data(7).await?;
```

### API Routes

Base path: `/api/test/`

#### POST `/api/test/mark-test-data`
Mark a specific entity as test data.

**Request:**
```json
{
  "entity_id": "uuid",
  "test_suite": "e2e",
  "test_name": "optional-test-name"
}
```

**Response:** `200 OK`

#### POST `/api/test/mark-current-user`
Mark the current authenticated user as a test account. **All entities created by this user will automatically be marked as test data.**

**Request:**
```json
{
  "test_suite": "e2e",
  "test_name": "optional-test-name"
}
```

**Response:** `200 OK`

#### GET `/api/test/is-test-data/:entity_id`
Check if an entity is marked as test data.

**Response:**
```json
{
  "is_test_data": true
}
```

#### POST `/api/test/cleanup/:days` (Admin Only)
Clean up test data older than specified days.

**Response:**
```json
{
  "deleted_count": 42,
  "deleted_ids": ["uuid1", "uuid2", ...]
}
```

## Frontend Usage

### Import Test Marker Utilities

```typescript
import {
  markEntityAsTestData,
  markCurrentUserAsTest,
  isTestData,
} from '@/lib/testMarker';
```

### Mark Current User (Recommended for E2E Tests)

```typescript
// In test setup (beforeEach)
await markCurrentUserAsTest('projects-e2e-test');

// Now all entities created by this user are automatically marked as test data
```

### Mark Specific Entity

```typescript
const project = await createProject({ name: 'Test Project' });
await markEntityAsTestData(project.id, {
  testSuite: 'e2e',
  testName: 'project-creation-test',
});
```

### Check if Entity is Test Data

```typescript
const isTest = await isTestData(entityId);
if (isTest) {
  console.log('This is test data');
}
```

## E2E Test Integration

### Playwright Example

```typescript
import { test, expect } from '@playwright/test';

test.describe('Projects E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login test user
    await page.goto('/register');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');

    // Mark current user as test - all their data will be marked automatically
    await page.evaluate(async () => {
      await fetch('/api/test/mark-current-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          test_suite: 'e2e',
          test_name: 'projects-test',
        }),
      });
    });
  });

  test('create project', async ({ page }) => {
    // This project will be automatically marked as test data
    await page.goto('/projects/new');
    await page.fill('[name="name"]', 'Test Project');
    await page.click('button[type="submit"]');
    
    // Verify creation
    await expect(page.getByText('Test Project')).toBeVisible();
  });
});
```

## Auto-Detection Features

### Automatic Marking

When a test user (marked with `mark_as_test_data`) creates entities, those entities are **automatically marked as test data**:

```rust
// In ProjectService::create_project()
let owner_is_test = sqlx::query_scalar::<_, bool>(
    "SELECT is_test_data($1)"
)
.bind(owner_id)
.fetch_one(&self.pool)
.await?;

if owner_is_test {
    // Auto-mark the project as test data
    sqlx::query("SELECT mark_as_test_data($1, 'e2e', 'auto-marked')")
        .bind(project_id)
        .execute(&self.pool)
        .await?;
}
```

### Automatic Filtering

List operations automatically filter out test data for regular users:

```rust
// In ProjectService::list_projects()
let projects = sqlx::query_as::<_, Project>(
    "SELECT * FROM unified_projects 
     WHERE id = ANY($1) 
     AND NOT is_test_data(id)" // Auto-filter test data
)
.bind(&accessible_ids)
.fetch_all(&self.pool)
.await?;
```

## Cleanup Strategy

### Manual Cleanup (Admin)

```bash
curl -X POST http://localhost:5300/api/test/cleanup/7 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Scheduled Cleanup (Recommended)

Add a cron job or scheduled task:

```sql
-- Run daily at 2 AM
SELECT cleanup_expired_test_data(7);
-- Deletes test data older than 7 days
```

### Kubernetes CronJob Example

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-test-data
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: postgres:15
            command:
            - psql
            - "$(DATABASE_URL)"
            - -c
            - "SELECT cleanup_expired_test_data(7);"
          restartPolicy: OnFailure
```

## Benefits

### ✅ Clean Data Separation
- Test data never shown to regular users
- Production views automatically filtered
- No risk of data pollution

### ✅ Safe Production Testing
- Run E2E tests against production DB safely
- No manual cleanup required
- Automatic expiration

### ✅ Ontology-First Design
- Uses relationship types (not flags)
- Queryable through standard ontology APIs
- Consistent with system architecture

### ✅ Developer Experience
- Simple API: one call to `markCurrentUserAsTest()`
- Auto-detection for child entities
- Graceful handling in tests

## Migration Applied

**Migration:** `20270125000000_test_data_marker.sql`

**Status:** ✅ Applied

**Created:**
- TestMarker class
- Singleton test marker entity
- Relationship type `marked_as_test`
- 4 helper functions
- 2 production views

## Monitoring

### Check Test Data Count

```sql
-- Count test entities by class
SELECT 
  c.name as class,
  COUNT(DISTINCT e.id) as test_entities
FROM entities e
JOIN classes c ON e.class_id = c.id
WHERE is_test_data(e.id)
GROUP BY c.name
ORDER BY test_entities DESC;
```

### List Test Users

```sql
SELECT 
  e.id,
  e.display_name,
  e.created_at
FROM entities e
WHERE e.class_id = (SELECT id FROM classes WHERE name = 'User')
AND is_test_data(e.id)
ORDER BY e.created_at DESC;
```

### Check Specific Entity

```sql
SELECT 
  e.id,
  e.display_name,
  c.name as class,
  is_test_data(e.id) as is_test,
  r.attributes->>'test_suite' as test_suite,
  r.attributes->>'test_name' as test_name
FROM entities e
JOIN classes c ON e.class_id = c.id
LEFT JOIN relationships r ON r.source_entity_id = e.id 
  AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'marked_as_test')
WHERE e.id = 'your-entity-uuid-here';
```

## Troubleshooting

### Test Data Still Visible

**Problem:** Test data appears in production views.

**Solution:**
```sql
-- Verify entity is marked
SELECT is_test_data('entity-uuid');

-- If false, mark it manually
SELECT mark_as_test_data('entity-uuid', 'e2e', 'manual-mark');
```

### Automatic Marking Not Working

**Problem:** Entities created by test users aren't being marked.

**Checklist:**
1. Is the user marked as test?
   ```sql
   SELECT is_test_data('user-uuid');
   ```
2. Does the service have auto-detection code?
3. Check backend logs for errors

### Cleanup Not Working

**Problem:** Old test data not being deleted.

**Solution:**
```sql
-- Check if function exists
\df cleanup_expired_test_data

-- Run manually with logging
SELECT * FROM cleanup_expired_test_data(7);

-- Check deleted_at timestamps
SELECT id, display_name, created_at, deleted_at
FROM entities
WHERE is_test_data(id)
ORDER BY created_at DESC
LIMIT 10;
```

## Future Enhancements

- [ ] Dashboard for test data visualization
- [ ] Test run history tracking
- [ ] Per-suite cleanup policies
- [ ] Integration with CI/CD pipelines
- [ ] Test data analytics
- [ ] Automatic detection of orphaned test data
