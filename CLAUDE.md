# GSCC — Gestión de Procesos

Worker process manager webapp. Monitors and controls long-running Celery worker tasks through a web UI.

---

## Architecture

```
┌──────────────┐     HTTP/REST     ┌─────────────────┐
│   Frontend   │ ────────────────► │  Backend (API)  │
│  React+Vite  │                   │   FastAPI       │
│  port 5173   │                   │   port 8000     │
└──────────────┘                   └────────┬────────┘
                                            │
                           ┌────────────────┼────────────────┐
                           │                │                │
                    ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
                    │  PostgreSQL  │  │    Redis     │  │   Celery   │
                    │   port 5432  │  │  port 6379   │  │   Worker   │
                    └─────────────┘  └─────────────┘  └────────────┘
                                                              │
                                                       ┌──────▼──────┐
                                                       │    Flower    │
                                                       │  port 5555   │
                                                       └─────────────┘
```

### Components

| Service    | Tech                          | Purpose                                   |
|------------|-------------------------------|-------------------------------------------|
| `frontend` | React 18 + Vite + TypeScript  | Web UI (undecided: may migrate to Next.js)|
| `backend`  | FastAPI + SQLAlchemy (async)  | REST API                                  |
| `worker`   | Celery (same image as backend)| Executes background tasks                 |
| `db`       | PostgreSQL 16                 | Persistent storage                        |
| `redis`    | Redis 7                       | Celery broker + result backend            |
| `flower`   | Celery Flower                 | Celery task monitoring UI                 |

> **Frontend note:** The frontend currently uses plain React + Vite. If you migrate to Next.js,
> replace `frontend/` with a Next.js project and update `docker-compose.yml` accordingly (port 3000, different dev command).

---

## Project Structure

```
gscc-gestion-procesos/
├── CLAUDE.md
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production
├── .env.example                # Copy to .env
├── .gitignore
│
├── backend/
│   ├── Dockerfile              # Dev (hot reload)
│   ├── Dockerfile.prod         # Production (multi-stage)
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py              # Async Alembic config
│   │   ├── script.py.mako
│   │   └── versions/           # Migration files go here
│   └── app/
│       ├── main.py             # FastAPI app entry point
│       ├── config.py           # Pydantic settings
│       ├── database.py         # Async SQLAlchemy engine + session
│       ├── celery_app.py       # Celery instance
│       ├── models/             # SQLAlchemy ORM models
│       ├── schemas/            # Pydantic request/response schemas
│       ├── routers/            # FastAPI route handlers
│       └── tasks/              # Celery task definitions
│
├── frontend/
│   ├── Dockerfile              # Dev (Vite dev server)
│   ├── Dockerfile.prod         # Production (nginx static)
│   ├── nginx.conf              # nginx config for prod frontend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       └── App.tsx
│
└── nginx/
    └── nginx.conf              # Prod reverse proxy (optional)
```

---

## Getting Started

### Prerequisites
- Docker + Docker Compose v2

### First run

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your values

# 2. Start all services
docker compose up --build

# 3. Run database migrations (first time and after new migrations)
docker compose exec backend alembic upgrade head
```

### Available services (dev)

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5173       |
| API      | http://localhost:8000       |
| API docs | http://localhost:8000/docs  |
| Flower   | http://localhost:5555       |
| DB       | localhost:5432              |
| Redis    | localhost:6379              |

---

## Common Commands

### Development

```bash
# Start everything
docker compose up

# Start in background
docker compose up -d

# Rebuild a specific service after dependency changes
docker compose up --build backend

# View logs
docker compose logs -f backend
docker compose logs -f worker

# Stop everything
docker compose down

# Stop and remove volumes (DESTROYS DATA)
docker compose down -v
```

### Database Migrations (Alembic)

```bash
# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Create a new migration (auto-generate from model changes)
docker compose exec backend alembic revision --autogenerate -m "describe your change"

# Rollback one migration
docker compose exec backend alembic downgrade -1

# Show migration history
docker compose exec backend alembic history

# Show current revision
docker compose exec backend alembic current
```

### Running the Celery Worker Manually

```bash
# Inside the worker container
docker compose exec worker celery -A app.celery_app worker --loglevel=info

# With concurrency
docker compose exec worker celery -A app.celery_app worker --loglevel=info --concurrency=4
```

### Production

```bash
# Build and start production stack
docker compose -f docker-compose.prod.yml up --build -d

# Run migrations in production
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## Backend Development Notes

- **Async first:** All database queries use `async/await` via `asyncpg`. Don't introduce sync DB calls in request handlers.
- **Alembic migrations:** After changing any `app/models/` file, generate a migration. Never edit the DB schema manually.
- **Celery tasks:** Define tasks in `app/tasks/`. Import them in `app/celery_app.py` via the `include` list.
- **Config:** All configuration comes from environment variables through `app/config.py` (Pydantic Settings). Never hardcode secrets.
- **Routers:** Add new FastAPI routers in `app/routers/` and register them in `app/main.py`.
- **Dependencies:** Managed with Poetry (`pyproject.toml`). The prod image skips the `dev` group (`--without dev`).

### Managing Dependencies with Poetry

```bash
# Add a production dependency
docker compose exec backend poetry add <package>

# Add a dev-only dependency
docker compose exec backend poetry add --group dev <package>

# Remove a dependency
docker compose exec backend poetry remove <package>

# Show installed packages
docker compose exec backend poetry show

# Update all dependencies (within version constraints)
docker compose exec backend poetry update

# Regenerate poetry.lock without upgrading
docker compose exec backend poetry lock --no-update
```

After any `poetry add` / `poetry remove`, rebuild the image so the lock file changes take effect:
```bash
docker compose up --build backend
```

## Frontend Development Notes

- **API calls:** Use the `VITE_API_URL` env variable as the base URL for all API requests.
- **Types:** Mirror backend Pydantic schemas as TypeScript interfaces.

---

## Tech Stack Versions

| Tech            | Version  |
|-----------------|----------|
| Python          | 3.12     |
| Poetry          | 1.8.x    |
| FastAPI         | ≥0.109   |
| SQLAlchemy      | ≥2.0     |
| Alembic         | ≥1.13    |
| Celery          | ≥5.3     |
| Redis           | 7        |
| PostgreSQL      | 16       |
| Node.js         | 20       |
| React           | 18       |
| Vite            | 5        |
| TypeScript      | 5        |
