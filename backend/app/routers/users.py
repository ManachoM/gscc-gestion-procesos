from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password, verify_password
from app.database import get_db
from app.dependencies import require_role
from app.models import Role, User
from app.schemas import UserCreate, UserOut, UserPasswordUpdate, UserUpdate

router = APIRouter()

_admin = require_role(Role.admin)


async def _get_user_or_404(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("", response_model=list[UserOut])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    _: User = _admin,
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    result = await db.execute(select(User).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    _: User = _admin,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=body.is_active,
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    return user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    _: User = _admin,
    db: AsyncSession = Depends(get_db),
) -> User:
    return await _get_user_or_404(user_id, db)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdate,
    _: User = _admin,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await _get_user_or_404(user_id, db)
    if body.email is not None:
        user.email = body.email
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    _: User = _admin,
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user_or_404(user_id, db)
    await db.delete(user)
    await db.commit()


@router.patch("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    user_id: int,
    body: UserPasswordUpdate,
    _: User = _admin,
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user_or_404(user_id, db)
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
