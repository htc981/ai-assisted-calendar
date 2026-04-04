from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import timedelta
from ..database import get_db
from ..schemas import UserLogin, UserRegister, UserResponse, Token
from ..auth import create_access_token
from ..config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    result = db.execute(
        text("SELECT user_id FROM User WHERE email = :email"),
        {"email": user_data.email}
    )
    if result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create user
    result = db.execute(
        text("INSERT INTO User (name, email) VALUES (:name, :email)"),
        {"name": user_data.name, "email": user_data.email}
    )
    db.commit()

    # Fetch created user
    user_id = result.lastrowid
    result = db.execute(
        text("SELECT user_id, name, email, created_at FROM User WHERE user_id = :id"),
        {"id": user_id}
    )
    user = result.fetchone()

    return UserResponse(
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        created_at=user.created_at
    )


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token. Does NOT auto-register."""
    # Find user
    result = db.execute(
        text("SELECT user_id FROM User WHERE email = :email"),
        {"email": credentials.email}
    )
    user = result.fetchone()

    if not user:
        # Do NOT auto-register - require explicit registration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please register first."
        )

    user_id = user.user_id
    
    # Update name if provided (optional profile update on login)
    if credentials.name:
        db.execute(
            text("UPDATE User SET name = :name WHERE user_id = :id"),
            {"name": credentials.name, "id": user_id}
        )
        db.commit()

    # Create access token
    access_token = create_access_token(
        data={"sub": user_id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {"access_token": access_token, "token_type": "bearer"}
