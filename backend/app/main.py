from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import router

app = FastAPI(
    title=settings.app_name,
    description="REST API for the worker process manager.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    # In production, replace with your actual frontend domain
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Next.js dev server (if migrated)
        "http://localhost:80",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok", "service": "backend"}
