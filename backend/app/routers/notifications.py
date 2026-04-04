from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from ..database import get_db
from ..schemas import APIResponse
from ..auth import verify_token
from fastapi import Header
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


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


class NotificationResponse(BaseModel):
    notification_id: int
    created_at: datetime
    from_user_id: int
    from_user_name: str
    event_id: int
    event_title: Optional[str]
    notification_type: str
    message: str
    is_read: bool
    action_taken: Optional[str]


@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get notifications for current user."""
    result = db.execute(
        text("""
        CALL sp_get_notifications(:user_id, :limit)
        """),
        {"user_id": user_id, "limit": limit}
    )
    notifications = result.fetchall()
    
    return [
        NotificationResponse(
            notification_id=n.notification_id,
            created_at=n.created_at,
            from_user_id=n.from_user_id,
            from_user_name=n.from_user_name,
            event_id=n.event_id,
            event_title=n.event_title,
            notification_type=n.notification_type,
            message=n.message,
            is_read=n.is_read,
            action_taken=n.action_taken
        )
        for n in notifications
    ]


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get count of unread notifications."""
    result = db.execute(
        text("CALL sp_get_unread_count(:user_id)"),
        {"user_id": user_id}
    )
    row = result.fetchone()
    return {"unread_count": row.unread_count if row else 0}


@router.post("/{notification_id}/read", response_model=APIResponse)
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Mark notification as read."""
    result = db.execute(
        text("""
        CALL sp_mark_notification_read(:notification_id, :user_id, @success, @message)
        """),
        {"notification_id": notification_id, "user_id": user_id}
    )

    result = db.execute(text("SELECT @success AS success, @message AS message"))
    row = result.fetchone()

    db.commit()
    
    if not row.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=row.message
        )
    
    return {"success": True, "message": row.message}


@router.post("/read-all", response_model=APIResponse)
def mark_all_as_read(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Mark all notifications as read."""
    db.execute(
        text("""
        UPDATE Notification SET is_read = TRUE
        WHERE user_id = :user_id AND is_read = FALSE
        """),
        {"user_id": user_id}
    )
    db.commit()
    
    return {"success": True, "message": "All notifications marked as read"}
