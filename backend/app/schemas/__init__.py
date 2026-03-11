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
