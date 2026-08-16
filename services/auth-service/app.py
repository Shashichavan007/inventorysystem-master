import os
import sys
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Ensure shared imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from shared.database import get_db, create_tables, User
from shared.utils.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user_payload
)
from shared.utils.logging import setup_logger

logger = setup_logger("auth_service")
app = FastAPI(title="ScaleFlow Auth Service", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    await create_tables()
    logger.info("Auth Service started and database tables ensured.")

# Pydantic Schemas
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "CUSTOMER"  # CUSTOMER or ADMIN

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    role: str
    full_name: str

class RefreshRequest(BaseModel):
    refresh_token: str

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "auth-service"}

@app.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Enforce allowed roles
    role = req.role.upper() if req.role.upper() in ["CUSTOMER", "ADMIN"] else "CUSTOMER"
    
    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    access_token = create_access_token(user.id, user.email, user.role)
    refresh_token = create_refresh_token(user.id)
    
    logger.info(f"Registered new user {user.email} (ID: {user.id}, Role: {user.role})")
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name
    )

@app.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(user.id, user.email, user.role)
    refresh_token = create_refresh_token(user.id)
    
    logger.info(f"User {user.email} logged in successfully.")
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name
    )

@app.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Invalid refresh token")
    
    user_id = int(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or not found")
    
    access_token = create_access_token(user.id, user.email, user.role)
    new_refresh_token = create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user_id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name
    )

@app.get("/me")
async def get_me(payload: dict = Depends(get_current_user_payload), db: AsyncSession = Depends(get_db)):
    user_id = int(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
