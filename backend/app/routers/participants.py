from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from ..database import get_db
from ..schemas import ParticipantAdd, ParticipantResponse, ParticipantUpdateResponse, APIResponse
from ..auth import verify_token
from fastapi import Header

router = APIRouter(prefix="/api/events/{event_id}/participants", tags=["Participants"])


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


def check_event_access(event_id: int, user_id: int, db: Session) -> bool:
    """Check if user has access to event."""
    result = db.execute(
        text("""
        SELECT 1 FROM Event e
        LEFT JOIN Participant p ON e.event_id = p.event_id AND p.user_id = :uid
        WHERE e.event_id = :eid AND (e.creator_id = :uid OR p.user_id = :uid)
        """),
        {"eid": event_id, "uid": user_id}
    )
    return result.fetchone() is not None


@router.get("", response_model=List[ParticipantResponse])
def list_participants(
    event_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """List all participants for an event."""
    if not check_event_access(event_id, user_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view participants"
        )
    
    result = db.execute(
        text("""
        SELECT user_id, event_id, role, response, created_at
        FROM Participant
        WHERE event_id = :event_id
        """),
        {"event_id": event_id}
    )
    participants = result.fetchall()
    
    return [
        ParticipantResponse(
            user_id=p.user_id,
            event_id=p.event_id,
            role=p.role,
            response=p.response,
            created_at=p.created_at
        )
        for p in participants
    ]


@router.post("", response_model=APIResponse)
def add_participant(
    event_id: int,
    participant: ParticipantAdd,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Add a participant to an event."""
    # Check if user is creator
    result = db.execute(
        text("SELECT creator_id FROM Event WHERE event_id = :id"),
        {"id": event_id}
    )
    event = result.fetchone()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can add participants"
        )
    
    # Call stored procedure
    db.execute(
        text("""
        CALL sp_add_participant(:event_id, :user_id, :role, @success, @message)
        """),
        {"event_id": event_id, "user_id": participant.user_id, "role": participant.role.value}
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


@router.put("/{participant_id}/response", response_model=APIResponse)
def update_response(
    event_id: int,
    participant_id: int,
    response_data: ParticipantUpdateResponse,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Update participant response (for the current user)."""
    # User can only update their own response
    if participant_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update your own response"
        )
    
    # Call stored procedure
    db.execute(
        text("""
        CALL sp_update_participant_response(
            :event_id, :user_id, :response, @success, @message
        )
        """),
        {
            "event_id": event_id,
            "user_id": participant_id,
            "response": response_data.response.value
        }
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


@router.delete("/{participant_id}", response_model=APIResponse)
def remove_participant(
    event_id: int,
    participant_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Remove a participant from an event."""
    # Check if user is creator or removing themselves
    result = db.execute(
        text("SELECT creator_id FROM Event WHERE event_id = :id"),
        {"id": event_id}
    )
    event = result.fetchone()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Only creator can remove others, or user can remove themselves
    if event.creator_id != user_id and participant_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to remove this participant"
        )
    
    # Call stored procedure
    db.execute(
        text("""
        CALL sp_remove_participant(:event_id, :user_id, @success, @message)
        """),
        {"event_id": event_id, "user_id": participant_id}
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
