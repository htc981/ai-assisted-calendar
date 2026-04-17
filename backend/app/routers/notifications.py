from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from ..database import get_db
from ..schemas import APIResponse
from ..auth import verify_token

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


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


@router.get("", response_model=Dict[str, Any])
def get_pending_invitations(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get all pending invitations for the current user."""
    result = db.execute(
        text("""
        SELECT n.notification_id, n.created_at, n.from_user_id, n.event_id, 
               n.notification_type, n.message, n.is_read, n.action_taken,
               u.name as from_user_name, u.email as from_user_email,
               e.title as event_title, e.description as event_description,
               e.priority, e.start_time, e.end_time, e.status, e.estimated_duration,
               p.response as participant_response
        FROM Notification n
        JOIN User u ON n.from_user_id = u.user_id
        JOIN Event e ON n.event_id = e.event_id
        LEFT JOIN Participant p ON n.event_id = p.event_id AND p.user_id = :user_id
        WHERE n.user_id = :user_id
          AND n.action_taken IS NULL
          AND n.notification_type = 'invitation'
        ORDER BY n.created_at DESC
        """),
        {"user_id": user_id}
    )
    
    notifications = []
    for row in result.fetchall():
        notifications.append({
            "notification_id": row.notification_id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "from_user": {
                "user_id": row.from_user_id,
                "name": row.from_user_name,
                "email": row.from_user_email
            },
            "event": {
                "event_id": row.event_id,
                "title": row.event_title,
                "description": row.event_description,
                "priority": row.priority,
                "start_time": row.start_time.isoformat() if row.start_time else None,
                "end_time": row.end_time.isoformat() if row.end_time else None,
                "status": row.status,
                "estimated_duration": row.estimated_duration
            },
            "participant_response": row.participant_response
        })
    
    return {"invitations": notifications}


@router.put("/{notification_id}/action", response_model=APIResponse)
def handle_invitation_response(
    notification_id: int,
    response_data: Dict[str, str],
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Handle invitation response (accept/decline/tentative)."""
    response_type = response_data.get("response")
    
    if response_type not in ['accepted', 'declined', 'tentative']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid response type. Must be 'accepted', 'declined', or 'tentative'"
        )
    
    # Check if notification exists and belongs to user
    notification_result = db.execute(
        text("""
        SELECT n.notification_id, n.event_id, n.user_id, n.from_user_id,
               n.notification_type
        FROM Notification n
        WHERE n.notification_id = :notification_id
        """),
        {"notification_id": notification_id}
    )
    notification = notification_result.fetchone()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    if notification.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to this notification"
        )
    
    # Get event details
    event_result = db.execute(
        text("""
        SELECT e.event_id, e.creator_id, e.title, e.description, e.priority,
               e.start_time, e.end_time, e.status, e.estimated_duration
        FROM Event e
        WHERE e.event_id = :event_id
        """),
        {"event_id": notification.event_id}
    )
    event = event_result.fetchone()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    try:
        if response_type == 'accepted':
            # Check for conflicts
            conflict_result = db.execute(
                text("""
                SELECT event_id, title, start_time, end_time, priority, status
                FROM Event
                WHERE status = 'scheduled'
                  AND event_id != :event_id
                  AND (
                    (:new_start < end_time AND :new_end > start_time)
                    OR (start_time < :new_end AND end_time > :new_start)
                  )
                """),
                {
                    "event_id": notification.event_id,
                    "new_start": event.start_time,
                    "new_end": event.end_time
                }
            )
            conflicting_events = conflict_result.fetchall()

            # Process conflicts
            # Note: Lower priority number = Higher priority (1=Urgent, 5=Optional)
            overridden_events = []
            for conflict in conflicting_events:
                if conflict.priority <= event.priority:
                    # Conflict has higher or equal priority - reject acceptance
                    db.execute(
                        text("""
                        UPDATE Notification
                        SET is_read = 1, action_taken = 'declined'
                        WHERE notification_id = :notification_id
                        """),
                        {"notification_id": notification_id}
                    )
                    db.execute(
                        text("""
                        UPDATE Participant
                        SET response = 'declined'
                        WHERE event_id = :event_id AND user_id = :user_id
                        """),
                        {"event_id": notification.event_id, "user_id": user_id}
                    )
                    return {"success": False, "message": f"Cannot accept: conflicts with {'equal or higher priority event' if conflict.priority == event.priority else 'higher priority event'} '{conflict.title}'"}
                elif conflict.priority > event.priority:
                    # Conflict has lower priority - unschedule (move back to unscheduled)
                    db.execute(
                        text("""
                        UPDATE Event
                        SET status = 'unscheduled', start_time = NULL, end_time = NULL
                        WHERE event_id = :conflict_id
                        """),
                        {"conflict_id": conflict.event_id}
                    )
                    overridden_events.append(conflict.event_id)
            
            # Schedule the event
            if event.status == 'unscheduled':
                db.execute(
                    text("""
                    UPDATE Event 
                    SET status = 'scheduled'
                    WHERE event_id = :event_id
                    """),
                    {"event_id": notification.event_id}
                )
            
            # Update participant response
            db.execute(
                text("""
                UPDATE Participant 
                SET response = 'accepted'
                WHERE event_id = :event_id AND user_id = :user_id
                """),
                {"event_id": notification.event_id, "user_id": user_id}
            )
            
            # Mark notification as read and action taken
            db.execute(
                text("""
                UPDATE Notification 
                SET is_read = 1, action_taken = 'accepted'
                WHERE notification_id = :notification_id
                """),
                {"notification_id": notification_id}
            )
            
            if overridden_events:
                message = f"Invitation accepted! Overridden lower priority events: {', '.join(map(str, overridden_events))}"
            else:
                message = "Invitation accepted!"
                
        elif response_type == 'declined':
            # Update participant response
            db.execute(
                text("""
                UPDATE Participant 
                SET response = 'declined'
                WHERE event_id = :event_id AND user_id = :user_id
                """),
                {"event_id": notification.event_id, "user_id": user_id}
            )
            
            # Mark notification as read and action taken
            db.execute(
                text("""
                UPDATE Notification 
                SET is_read = 1, action_taken = 'declined'
                WHERE notification_id = :notification_id
                """),
                {"notification_id": notification_id}
            )
            message = "Invitation declined"
            
        elif response_type == 'tentative':
            # Update participant response
            db.execute(
                text("""
                UPDATE Participant 
                SET response = 'tentative'
                WHERE event_id = :event_id AND user_id = :user_id
                """),
                {"event_id": notification.event_id, "user_id": user_id}
            )
            
            # Clear action_taken to move back to mailbox for future changes
            # Mark as read so it appears in the tentative section
            db.execute(
                text("""
                UPDATE Notification 
                SET is_read = 1, action_taken = NULL
                WHERE notification_id = :notification_id
                """),
                {"notification_id": notification_id}
            )
            message = "Response set to tentative. You can change your response later."
        
        db.commit()
        
        return {"success": True, "message": message}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing response: {str(e)}"
        )
