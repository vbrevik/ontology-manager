# Network Segmentation

Date: 2026-01-18

## Goals

- Isolate the database from direct host access.
- Limit service communication to required networks only.
- Reduce lateral movement risk.

## Current Network Layout

```text
frontend_net:  frontend ↔ backend
backend_net:   backend ↔ db ↔ backup ↔ llm
data_net:      db only (internal, no host access)
```

## Key Changes

- Database service no longer exposes host ports.
- Database remains on `data_net` (internal) and `backend_net` for service access.
- Backend remains on `frontend_net` and `backend_net`.
- Backup agent stays on `backend_net` only.
- LLM uses a named volume instead of a host mount.

## Access Patterns

- Frontend → Backend via `frontend_net`
- Backend → DB via `backend_net`
- Backup → DB via `backend_net`
- DB is not reachable from host or frontend directly

## Operational Notes

- Use `docker compose exec db psql` for database access.
- Keep `data_net` internal to avoid host exposure.
- Avoid adding new services to `data_net` unless they need direct DB access.

## What NOT to do

- Do not expose DB ports to the host in production.
- Do not attach frontend to `backend_net` or `data_net`.
- Do not mount host paths into security-sensitive services.
- Do not bypass `data_net` for convenience.
- Do not add external ports without updating `docs/ports.md`.
