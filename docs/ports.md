Backend and frontend port assignments

- **backend API**: `5300` (Axum server; `backend/src/main.rs` binds to this port)
- **frontend (vite)**: `5373` (set in `frontend/vite.config.ts`)
- **databases (docker)**: `5301-5310` (reserved range for docker-based database services)
- **ollama (llm)**: `11434` (Ollama API exposed by `llm` service)

Notes:
- Backend's default `backend/config/default.toml` uses PostgreSQL at `postgres://app:app_password@localhost:5301/app_db`.
- Docker compose has been added at `docker-compose.yml`. Current service mappings:
  - `backend` container: maps host `5300:5300` (container listens on 5300)
  - `frontend` container: maps host `5373:5373`
  - `llm` container: maps host `11434:11434`
  - Database containers should use ports in the `5301-5310` range
- The backend service uses the `db` container and sets `DATABASE_URL=postgres://app:app_password@db:5432/app_db?sslmode=disable`.
- For Mac M1/M2 (Apple Silicon) ensure Docker Desktop Buildx is enabled for multi-arch builds; the `backend/Dockerfile` is a multi-stage build but may require additional tweaks for cross-architecture images.

Usage:
- Build images and start services locally:
  ```bash
  docker compose build
  docker compose up
  ```



