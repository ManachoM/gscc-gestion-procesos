"""Bootstrap the first admin user.

Usage:
    docker compose exec backend python -m app.seed

Reads SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from the environment,
or prompts interactively if those variables are not set.
"""
import asyncio
import os
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth import hash_password
from app.config import settings
from app.models import Role, User


def _prompt(label: str) -> str:
    """Read a line from stdin, bypassing surrogate-escape issues in Docker TTYs."""
    sys.stdout.write(label)
    sys.stdout.flush()
    return sys.stdin.buffer.readline().decode("utf-8", errors="ignore").strip()


async def seed() -> None:
    email = os.environ.get("SEED_ADMIN_EMAIL") or _prompt("Admin email: ")
    password = os.environ.get("SEED_ADMIN_PASSWORD") or _prompt("Admin password: ")

    engine = create_async_engine(settings.database_url, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"User already exists: id={existing.id} email={existing.email} role={existing.role}")
            await engine.dispose()
            return

        user = User(
            email=email,
            hashed_password=hash_password(password),
            role=Role.admin,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Admin created: id={user.id} email={user.email}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
