from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from ..database import get_db
from ..schemas import UserResponse
from ..auth import verify_token
from fastapi import Header

router = APIRouter(prefix="/api/users", tags=["Users"])


def get_current_user_id(authorization: str = Header(None)) -> int:
    """Extract user_id from JWT token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
    
    token = authorization.replace("Bearer ", "")
    user_id = verify_token(token)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return user_id


@router.get("/me", response_model=UserResponse)
def get_current_user(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get current user details."""
    result = db.execute(
        text("SELECT user_id, name, email, created_at FROM User WHERE user_id = :id"),
        {"id": user_id}
    )
    user = result.fetchone()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        created_at=user.created_at
    )


@router.get("", response_model=List[UserResponse])
def list_users(
    search: str = None,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """List all users (for participant search)."""
    if search:
        query = text("SELECT user_id, name, email, created_at FROM User WHERE name LIKE :search OR email LIKE :search")
        result = db.execute(query, {"search": f"%{search}%"})
    else:
        query = text("SELECT user_id, name, email, created_at FROM User")
        result = db.execute(query)
    
    users = result.fetchall()
    return [
        UserResponse(
            user_id=u.user_id,
            name=u.name,
            email=u.email,
            created_at=u.created_at
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Get user details by ID."""
    result = db.execute(
        text("SELECT user_id, name, email, created_at FROM User WHERE user_id = :id"),
        {"id": user_id}
    )
    user = result.fetchone()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        created_at=user.created_at
    )
