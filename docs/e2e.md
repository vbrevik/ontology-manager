End-to-end testing (Playwright)

Prerequisites
- Headless browser testing uses Playwright — dev dependency is included in `frontend/package.json`.
- Frontend dev server must be running: `cd frontend && npm run dev`
- Backend must be running on `http://localhost:3000` (see `docs/ports.md`)

Run tests

1. From workspace root, run:

```bash
cd frontend
npx playwright test
```

Or with npm script:

```bash
cd frontend
npm run test:e2e
```

What the test checks
- `frontend/tests/api-health.spec.ts` sends a request to `http://localhost:5173/api/health` and asserts the response status is 200 and the body equals `OK`. This verifies that the Vite dev server proxies `/api` to the backend server and that the backend `/api/health` endpoint is healthy.
- `frontend/tests/auth.spec.ts` registers a new user and logs in via the frontend proxy (`/api/register` and `/api/login`), asserting access and refresh tokens are returned. This ensures the full auth flow (API + DB) works end-to-end.

Test notes
- Tests create new users using a timestamped email to avoid collisions. The test suite cleans up test users before and after the auth tests by calling the backend test cleanup endpoint `POST /api/test/cleanup` with JSON body `{ "prefix": "e2e_user_" }`.
- The backend exposes the test cleanup endpoint only when the environment variable `ENABLE_TEST_ENDPOINTS=true` is set. This prevents accidental deletion in production environments.



