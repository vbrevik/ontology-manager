Backend and frontend port assignments

- **backend API**: `5300` (Axum server; `backend/src/main.rs` binds to this port)
- **frontend (vite)**: `5373` (set in `frontend/vite.config.ts`)
- **databases (docker)**: `5301-5310` (reserved range for docker-based database services)

Notes:
- Backend's default `backend/config/default.toml` uses SQLite at `data/app.db`; the backend expects the `backend/data` directory to exist.
- Docker compose has been added at `docker-compose.yml`. Current service mappings:
  - `backend` container: maps host `5300:5300` (container listens on 5300)
  - `frontend` container: maps host `5373:5373`
  - Database containers should use ports in the `5301-5310` range
- The backend service volume maps `./backend/data` -> `/app/data` inside the container; the compose file sets `DATABASE_URL=sqlite:////app/data/app.db`.
- For Mac M1/M2 (Apple Silicon) ensure Docker Desktop Buildx is enabled for multi-arch builds; the `backend/Dockerfile` is a multi-stage build but may require additional tweaks for cross-architecture images.

Usage:
- Build images and start services locally:
  ```bash
  docker compose build
  docker compose up
  ```



