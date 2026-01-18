# Test Mode System

## Overview

The Test Mode System provides a session-based approach to marking test data, similar to the firefighter mode. Users can temporarily activate "test mode" where all entities they create are automatically marked as test data for a specified duration.

## Architecture

### Database Layer

**Table: `test_mode_sessions`**
```sql
- id: UUID (primary key)
- user_id: UUID (references entities)
- test_suite: VARCHAR (e.g., "manual", "e2e", "integration")
- test_run_id: VARCHAR (optional grouping identifier)
- justification: TEXT (required reason)
- activated_at: TIMESTAMPTZ
- expires_at: TIMESTAMPTZ
- ended_at: TIMESTAMPTZ (NULL while active)
- ip_address: INET
- user_agent: TEXT
- entities_marked: INTEGER (counter)
- created_at: TIMESTAMPTZ
```

**Functions:**
- `is_in_test_mode(user_id)` - Check if user has active session
- `get_active_test_mode_session(user_id)` - Get session details
- `end_expired_test_mode_sessions()` - Maintenance task
- `mark_entity_in_test_session(entity_id, session_id, ...)` - Mark + count

**Trigger:**
- `auto_mark_test_mode_entities` - Automatically marks entities created during active test mode

**View:**
- `active_test_mode_sessions` - Currently active sessions with user details

### Session Flow

```
┌─────────────┐
│   User      │
│  Request    │
│  Test Mode  │
└──────┬──────┘
       │
       │ POST /api/test-mode/activate
       │ {justification, duration, test_suite}
       │
       ▼
┌──────────────────────┐
│  Create Session      │
│  - Validate          │
│  - Set expires_at    │
│  - Audit log         │
└──────┬───────────────┘
       │
       │ Session ID
       │
       ▼
┌──────────────────────┐
│  User creates        │
│  entities            │
│  (projects, etc)     │
└──────┬───────────────┘
       │
       │ Transaction begins
       │ SET LOCAL app.test_mode_session_id
       │
       ▼
┌──────────────────────┐
│  Trigger fires       │
│  auto_mark_test_mode │
│  - Mark entity       │
│  - Increment counter │
└──────┬───────────────┘
       │
       │ Entity marked
       │
       ▼
┌──────────────────────┐
│  Session expires OR  │
│  User deactivates    │
│  - Set ended_at      │
│  - Audit log         │
└──────────────────────┘
```

## Backend API

### Endpoints

Base path: `/api/test-mode/`

#### POST `/api/test-mode/activate`
Activate test mode for current user.

**Request:**
```json
{
  "test_suite": "manual",
  "test_run_id": "TEST-2026-01-18-001",
  "justification": "Testing project creation workflow",
  "duration_minutes": 120
}
```

**Response:**
```json
{
  "session": {
    "id": "uuid",
    "user_id": "uuid",
    "test_suite": "manual",
    "activated_at": "2026-01-18T16:00:00Z",
    "expires_at": "2026-01-18T18:00:00Z",
    "entities_marked": 0
  },
  "message": "Test mode activated for 120 minutes..."
}
```

**Errors:**
- `409 Conflict` - Already have active session
- `400 Bad Request` - Invalid duration

#### POST `/api/test-mode/deactivate`
Deactivate test mode early.

**Response:**
```json
{
  "message": "Test mode deactivated. 15 entities were marked...",
  "entities_marked": 15,
  "duration_minutes": 87.3
}
```

**Errors:**
- `404 Not Found` - No active session

#### GET `/api/test-mode/status`
Get current test mode status.

**Response:**
```json
{
  "is_active": true,
  "session": {
    "id": "uuid",
    "user_id": "uuid",
    "test_suite": "manual",
    "justification": "Testing...",
    "activated_at": "2026-01-18T16:00:00Z",
    "expires_at": "2026-01-18T18:00:00Z",
    "entities_marked": 5
  },
  "minutes_remaining": 45.2
}
```

#### GET `/api/test-mode/active-sessions` (Admin Only)
List all active test mode sessions.

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "test_suite": "manual",
    ...
  }
]
```

## Frontend Components

### TestModeIndicator

Banner component that shows active test mode session.

```tsx
import { TestModeIndicator } from '@/components/TestModeIndicator';

<TestModeIndicator />
// Shows banner when test mode is active
// Displays: suite, time remaining, entities marked
// Has "End Session" button
```

**Features:**
- Auto-refreshes every 30 seconds
- Shows countdown timer
- Entity counter
- Quick deactivate button

### TestModeToggle

Dialog component to activate test mode.

```tsx
import { TestModeToggle } from '@/components/TestModeToggle';

<TestModeToggle onActivate={() => window.location.reload()} />
```

**Form Fields:**
- Test Suite (dropdown): manual, e2e, integration, exploratory, qa
- Test Run ID (optional): Free text identifier
- Duration: 15min to 8 hours (default 2 hours)
- Justification (required): Textarea explaining why

## Integration with Unified Services

### Transaction-Scoped Context

Test mode uses PostgreSQL transaction-local variables to track the active session:

```rust
// In your service layer
pub async fn create_entity_with_test_mode(
    &self,
    user_id: Uuid,
    entity_data: CreateEntityData,
) -> Result<Entity, Error> {
    // Start transaction
    let mut tx = self.pool.begin().await?;
    
    // Check if user is in test mode
    if let Some(session) = test_mode_service.get_active_session(user_id).await? {
        // Set context variables for this transaction
        sqlx::query(&format!(
            "SET LOCAL app.test_mode_user_id = '{}'; \
             SET LOCAL app.test_mode_session_id = '{}'; \
             SET LOCAL app.test_suite = '{}'",
            user_id, session.id, session.test_suite
        ))
        .execute(&mut tx)
        .await?;
    }
    
    // Create entity - trigger will auto-mark if in test mode
    let entity = create_entity(&mut tx, entity_data).await?;
    
    tx.commit().await?;
    
    Ok(entity)
}
```

### Example: ProjectService Integration

```rust
// backend/src/features/projects/service.rs

impl ProjectService {
    pub async fn create_project(
        &self,
        input: CreateProjectInput,
        owner_id: Uuid,
    ) -> Result<Project, ProjectError> {
        let mut tx = self.pool.begin().await?;
        
        // Set test mode context if active
        if let Ok(Some(session)) = self.test_mode_service.get_active_session(owner_id).await {
            let _ = self.test_mode_service.set_test_mode_context(
                &mut tx,
                owner_id,
                session.id,
                &session.test_suite
            ).await;
        }
        
        // Create project entity
        let project_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO entities (id, class_id, display_name, attributes) 
             VALUES ($1, $2, $3, $4)"
        )
        .bind(project_id)
        .bind(project_class_id)
        .bind(&input.name)
        .bind(attributes)
        .execute(&mut tx)
        .await?;
        
        // Trigger auto-marks the entity if test mode is active!
        
        tx.commit().await?;
        
        Ok(project)
    }
}
```

## Usage Examples

### Manual Testing

User wants to test new feature without polluting production data:

1. Click "Enter Test Mode" button
2. Select "Manual Testing"
3. Duration: 2 hours
4. Justification: "Testing new project approval workflow"
5. Click "Activate Test Mode"
6. Banner appears showing active session
7. Create projects, tasks, etc. - all auto-marked
8. After testing, click "End Session" or let it expire

### E2E Testing

Programmatic activation in test setup:

```typescript
// E2E test
test.beforeEach(async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  
  // Activate test mode
  await page.evaluate(async () => {
    await fetch('/api/test-mode/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        test_suite: 'e2e',
        test_run_id: `E2E-${Date.now()}`,
        justification: 'Automated E2E test',
        duration_minutes: 30
      })
    });
  });
});

test('create project', async ({ page }) => {
  // This project will be auto-marked as test data
  await page.goto('/projects/new');
  // ... rest of test
});
```

## Comparison with Test Marker

| Feature | Test Marker | Test Mode |
|---------|-------------|-----------|
| **Activation** | Manual API call per entity | Session-based |
| **Duration** | Permanent until cleanup | Time-limited |
| **Auto-marking** | Optional | Automatic |
| **Justification** | Not required | Required |
| **Audit** | No | Yes |
| **Overhead** | Manual marking each entity | Set once, auto-mark all |
| **Best for** | API testing, cleanup scripts | Interactive testing |

## Database Queries

### Check if User is in Test Mode

```sql
SELECT is_in_test_mode('user-uuid-here');
-- Returns: true/false
```

### Get Active Session Details

```sql
SELECT * FROM get_active_test_mode_session('user-uuid-here');
```

### List All Active Sessions

```sql
SELECT * FROM active_test_mode_sessions;
```

### End Expired Sessions (Maintenance)

```sql
SELECT * FROM end_expired_test_mode_sessions();
```

### Count Entities Created in Test Mode

```sql
SELECT 
  tms.id as session_id,
  tms.test_suite,
  tms.entities_marked,
  EXTRACT(EPOCH FROM (tms.ended_at - tms.activated_at)) / 60 as duration_minutes
FROM test_mode_sessions tms
WHERE tms.ended_at IS NOT NULL
ORDER BY tms.activated_at DESC
LIMIT 10;
```

## Monitoring & Maintenance

### Active Sessions Report

```sql
SELECT 
  u.display_name as username,
  tms.test_suite,
  tms.justification,
  tms.activated_at,
  tms.expires_at,
  tms.entities_marked,
  ROUND(EXTRACT(EPOCH FROM (tms.expires_at - NOW())) / 60, 1) as minutes_remaining
FROM test_mode_sessions tms
JOIN entities u ON tms.user_id = u.id
WHERE tms.ended_at IS NULL
AND tms.expires_at > NOW()
ORDER BY tms.activated_at DESC;
```

### Session History

```sql
SELECT 
  u.display_name as username,
  tms.test_suite,
  tms.entities_marked,
  tms.activated_at,
  tms.ended_at,
  ROUND(EXTRACT(EPOCH FROM (COALESCE(tms.ended_at, tms.expires_at) - tms.activated_at)) / 60, 1) as duration_minutes
FROM test_mode_sessions tms
JOIN entities u ON tms.user_id = u.id
ORDER BY tms.activated_at DESC
LIMIT 20;
```

### Cleanup Old Sessions

```sql
-- Soft delete sessions older than 30 days
UPDATE test_mode_sessions
SET ended_at = NOW()
WHERE ended_at IS NULL
AND created_at < NOW() - INTERVAL '30 days';
```

## Security Considerations

### Access Control

- All endpoints require authentication
- Active sessions limited to one per user
- Justification required (audited)
- Admin can view all sessions

### Audit Trail

All test mode actions are logged:
```sql
SELECT * FROM audit_logs
WHERE action IN ('test_mode_activated', 'test_mode_ended')
ORDER BY created_at DESC;
```

### Session Limits

- Minimum duration: 15 minutes
- Maximum duration: 8 hours (480 minutes)
- Default: 2 hours (120 minutes)

## Troubleshooting

### "Already have active session"

**Problem:** User tries to activate while already active.

**Solution:**
```sql
-- Check status
SELECT * FROM active_test_mode_sessions WHERE user_id = 'user-uuid';

-- Force end session
UPDATE test_mode_sessions
SET ended_at = NOW()
WHERE user_id = 'user-uuid'
AND ended_at IS NULL;
```

### Entities Not Being Marked

**Problem:** Creating entities but they're not marked as test data.

**Checklist:**
1. Is test mode active? `SELECT is_in_test_mode('user-uuid')`
2. Is transaction setting context variables?
3. Check trigger is enabled: `\d+ entities`
4. Check trigger function exists: `\df auto_mark_test_mode_entities`

**Debug:**
```sql
-- Enable notice logging
SET client_min_messages TO NOTICE;

-- Create entity (should see NOTICE messages)
INSERT INTO entities ...;
```

### Session Won't Deactivate

**Problem:** Deactivate API returns error.

**Solution:**
```sql
-- Check for active session
SELECT * FROM test_mode_sessions
WHERE user_id = 'user-uuid'
AND ended_at IS NULL
AND expires_at > NOW();

-- Manual deactivation
UPDATE test_mode_sessions
SET ended_at = NOW()
WHERE user_id = 'user-uuid'
AND ended_at IS NULL
RETURNING *;
```

## Performance Impact

- **Minimal overhead**: One query to check session status
- **Transaction-scoped**: Variables don't persist beyond transaction
- **Index support**: Fast lookups on (user_id, expires_at)
- **Trigger efficiency**: Only fires on INSERT, quick relationship creation

## Future Enhancements

- [ ] Integration with CI/CD pipelines
- [ ] Automatic session extension based on activity
- [ ] Test run analytics dashboard
- [ ] Session templates for common scenarios
- [ ] Bulk session management for QA teams
- [ ] Integration with issue tracking (link to Jira tickets)
- [ ] Slack/Discord notifications for long-running sessions

## Migration

**Applied:** `20270126000000_test_mode_sessions.sql`

**Rollback (if needed):**
```sql
DROP TRIGGER IF EXISTS trigger_auto_mark_test_mode_entities ON entities;
DROP TRIGGER IF EXISTS trigger_audit_test_mode_session ON test_mode_sessions;
DROP FUNCTION IF EXISTS auto_mark_test_mode_entities();
DROP FUNCTION IF EXISTS audit_test_mode_session();
DROP FUNCTION IF EXISTS mark_entity_in_test_session(UUID, UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS end_expired_test_mode_sessions();
DROP FUNCTION IF EXISTS get_active_test_mode_session(UUID);
DROP FUNCTION IF EXISTS is_in_test_mode(UUID);
DROP VIEW IF EXISTS active_test_mode_sessions;
DROP TABLE IF EXISTS test_mode_sessions;
```
