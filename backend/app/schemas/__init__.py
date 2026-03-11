from pydantic import BaseModel

from app.models import Role


class LoginRequest(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    sub: str  # user email
    role: Role


class UserOut(BaseModel):
    id: int
    email: str
    role: Role
    is_active: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: str
    password: str
    role: Role = Role.viewer
    is_active: bool = True


class UserUpdate(BaseModel):
    email: str | None = None
    role: Role | None = None
    is_active: bool | None = None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str
