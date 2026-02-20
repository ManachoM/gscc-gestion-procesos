# Development image — mounts source code as a volume for hot reload
FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg2 and asyncpg compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source is mounted at runtime via docker-compose volume
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
