# Development image — mounts source code as a volume for hot reload
FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg2 and asyncpg compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Poetry config — install into the container's global Python (no virtualenv needed)
ENV POETRY_VERSION=1.8.3 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_CACHE_DIR=/tmp/poetry_cache

RUN pip install --no-cache-dir poetry==$POETRY_VERSION

# Install dependencies first for better layer caching
# (source code is mounted at runtime, so --no-root skips installing the package itself)
COPY pyproject.toml poetry.lock* ./
RUN poetry install --no-root && rm -rf $POETRY_CACHE_DIR

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
