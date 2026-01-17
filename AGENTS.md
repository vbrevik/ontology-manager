# Agent Guidelines for Ontology Manager

This document guides agentic coding assistants working on this repository.

---

## Build, Lint, and Test Commands

### Backend (Rust)

**Development:**
```bash
cd backend
cargo run
```

**Build:**
```bash
cd backend
cargo build
```

**Run specific test:**
```bash
# Single test in lib
cd backend
cargo test <test_name>

# Single test file
cd backend
cargo test --test <test_file_name>

# Run with output
cargo test <test_name> -- --nocapture

# Integration tests (requires DATABASE_URL)
cd backend
cargo test --test auth_test
```

**Run all tests:**
```bash
cd backend
cargo test
```

**Coverage:**
```bash
cd backend
cargo tarpaulin --lib --out Stdout
cargo tarpaulin --test <test_file> --out Stdout
```

**Lint/Format:**
```bash
cd backend
cargo clippy
cargo fmt --check
cargo fmt
```

**Fix warnings:**
```bash
cd backend
cargo fix --bin "template-repo-backend" --tests
```

### Frontend (TypeScript/React)

**Development:**
```bash
cd frontend
npm run dev
```

**Build:**
```bash
cd frontend
npm run build
```

**Run specific test:**
```bash
cd frontend
npm test -- <test_file_path>
```

**Run all unit tests:**
```bash
cd frontend
npm test
```

**Run E2E tests:**
```bash
cd frontend
npm run test:e2e
```

**Coverage:**
```bash
cd frontend
npm test -- --coverage
```

**Lint/Format:**
```bash
cd frontend
npm run lint  # if configured
```

---

## Backend Code Style (Rust)

### Imports
- Order: std → external → internal modules
- Group imports: `use std::*;` first, then `crate::`, then external crates
- Avoid glob imports (`*`) except in `mod.rs` re-exports
- Use `use crate::` for internal imports (not relative paths)

```rust
use std::sync::Arc;
use chrono::{Utc, Duration};
use crate::features::auth::service::AuthService;
use sqlx::{PgPool, Row};
```

### Types
- Prefer `&str` over `&String` for function arguments
- Use `String` for owned data, `&str` for borrowed
- Use `Option<T>` for nullable fields (not `Result<T, ()>`)
- Add `#[derive(Debug, Clone, Serialize, Deserialize)]` to DTOs
- Add `PartialEq, Eq` to types used in assertions

### Error Handling
- Use `thiserror::Error` for custom error types
- Implement `IntoResponse` trait for error types to convert to HTTP responses
- Use `?` operator for error propagation
- Map errors appropriately: database → `AuthError::DatabaseError`, etc.

```rust
#[derive(Error, Debug)]
pub enum MyError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
}

impl IntoResponse for MyError {
    fn into_response(self) -> Response {
        let status = match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, self.to_string()).into_response()
    }
}
```

### Naming Conventions
- **Modules/Files**: `snake_case.rs` (e.g., `auth_service.rs`)
- **Types/Structs**: `PascalCase` (e.g., `AuthService`)
- **Functions**: `snake_case` (e.g., `create_user`, `validate_token`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_LOGIN_ATTEMPTS`)
- **Private**: Use `_` prefix for intentionally unused vars: `_user`

### Async/Await
- All DB operations must be `async`
- Use `.await` on all async calls
- Use tokio runtime for async operations

### Database
- Use `sqlx::query!` macros for type-safe queries
- Use `#[sqlx(default)]` for optional fields
- Use `PgPool` for connection pooling
- Prefer `fetch_one()` over `fetch_all()` for single results

### Security
- Use Argon2 for password hashing (not bcrypt)
- Use RS256 algorithm for JWT
- Use HttpOnly, Secure, SameSite cookies
- Validate all user input with `validator` crate
- Use constant-time comparisons for secrets

---

## Frontend Code Style (TypeScript/React)

### Imports
- Order: React → external libs → internal modules
- Use `import { }` for named imports, `import x from` for defaults
- Use `@/` alias for internal imports

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
```

### Types
- Use `type` for type aliases, `interface` for object shapes
- Use `interface` when you need to extend or implement
- Use `export type` for shared types
- Use `type` for union types and function types

```typescript
interface User {
  id: string
  username: string
  email: string
}

export type AuthState = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}
```

### Components
- Use functional components with hooks
- Destructure props in function signature
- Use `interface` for props, not `type`
- Use `export function` for components (not `export default`)

```typescript
export function MyButton({ children, variant }: ButtonProps) {
  return <button className={variant}>{children}</button>
}
```

### Styling
- Use Tailwind CSS classes
- Use `cn()` utility for merging classes (from `@/lib/utils`)
- Use shadcn/ui components as base (install with `pnpm dlx shadcn@latest add <component>`)
- Prefer composition over custom styles

### State Management
- Use `useState` for local state
- Use Context API for global state (e.g., AuthContext)
- Use TanStack Query for server state
- Avoid prop drilling; use context

### Error Handling
- Use try/catch for async operations
- Show user-friendly error messages
- Log errors to console in development
- Use error boundaries for component errors

### Naming Conventions
- **Components**: `PascalCase` (e.g., `UserProfile`, `SessionTimeoutWarning`)
- **Hooks**: `camelCase` with `use` prefix (e.g., `useIdleTimer`, `useAuth`)
- **Files**: `PascalCase.tsx` for components, `snake_case.ts` for utilities
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `IDLE_LOGOUT_TIMEOUT`)

---

## Testing Guidelines

### Backend Tests
- Unit tests go in `src/` (same file with `#[cfg(test)]` module)
- Integration tests go in `tests/` directory
- Use `#[sqlx::test]` macro for tests requiring DB
- Use descriptive test names: `test_<function>_<scenario>`
- Test both success and error paths
- Mock external services when needed

```rust
#[sqlx::test]
async fn test_register_success(pool: PgPool) {
    let services = setup_services(pool).await;
    // ... test code
}
```

### Frontend Tests
- Unit tests: `src/**/*.test.tsx` (use Vitest + Testing Library)
- E2E tests: `tests/*.spec.ts` (use Playwright)
- Test user behavior, not implementation
- Use `screen` queries for accessibility
- Mock API calls in unit tests

### Coverage Targets
- Aim for 75%+ coverage on new features
- Prioritize critical paths (auth, permissions, data access)
- Run coverage with every PR

---

## Architecture Principles

### Backend
- Feature-based architecture: `src/features/<feature>/`
- Each feature has: `mod.rs`, `models.rs`, `service.rs`, `routes.rs`
- Use dependency injection via `State` extractor in routes
- Services hold business logic, routes handle HTTP concerns

### Frontend
- Feature-based: `src/features/<feature>/`
- Shared components: `src/components/`
- Hooks: `src/hooks/`
- Routes: File-based routing in `src/routes/`

### Data Flow
- Frontend → Backend: REST API with JSON
- Auth: HttpOnly cookies (no localStorage for tokens)
- Real-time: SSE streams for notifications

---

## Common Patterns

### Backend Route Handler
```rust
#[axum::debug_handler]
async fn my_handler(
    State(service): State<MyService>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<MyInput>,
) -> Result<Json<Output>, MyError> {
    let result = service.do_something(input).await?;
    Ok(Json(result))
}
```

### Frontend API Call
```typescript
export async function myApiCall(data: Input): Promise<Output> {
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return response.json()
}
```

### Frontend Hook Pattern
```typescript
export function useMyHook() {
  const [state, setState] = useState<State>(initial)
  
  useEffect(() => {
    // setup
    return () => { /* cleanup */ }
  }, [])
  
  return { state, setState }
}
```

---

## Development Workflow

1. Create feature branch from main
2. Implement changes following style guidelines
3. Write tests (aim for 75%+ coverage)
4. Run linting and fix warnings
5. Run tests and ensure they pass
6. Run coverage and verify targets
7. Commit with descriptive message
8. Create PR with description of changes

---

## Notes

- The project uses PostgreSQL with sqlx
- JWT uses RS256 with RSA keys
- Auth tokens stored in HttpOnly cookies
- Frontend uses TanStack Router for navigation
- UI components based on Radix UI + Tailwind
- Backend is async-first with tokio runtime
