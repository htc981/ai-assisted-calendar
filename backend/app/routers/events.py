from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..schemas import (
    EventCreate, EventUpdate, EventResponse, EventWithParticipants,
    EventSchedule, EventStatus, APIResponse
)
from ..auth import verify_token
from fastapi import Header

router = APIRouter(prefix="/api/events", tags=["Events"])


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


@router.get("", response_model=List[EventWithParticipants])
def list_events(
    status_filter: Optional[EventStatus] = Query(None, alias="status"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """List events for current user (as creator or participant)."""
    query = text("""
        SELECT DISTINCT e.event_id, e.creator_id, e.title, e.description,
               e.priority, e.start_time, e.end_time, e.status,
               e.estimated_duration, e.created_at, e.updated_at
        FROM Event e
        INNER JOIN Participant p ON e.event_id = p.event_id
        WHERE p.user_id = :user_id
          AND (
            -- Creator can see all their events
            e.creator_id = :user_id
            OR
            -- Participant can only see accepted events
            (e.creator_id != :user_id AND p.response = 'accepted')
          )
    """)
    params = {"user_id": user_id}

    if status_filter:
        query = text(query.text + " AND e.status = :status")
        params["status"] = status_filter.value

    if start_date:
        query = text(query.text + " AND e.start_time >= :start_date")
        params["start_date"] = start_date

    if end_date:
        query = text(query.text + " AND e.end_time <= :end_date")
        params["end_date"] = end_date

    query = text(query.text + " ORDER BY COALESCE(e.start_time, e.created_at) DESC")

    result = db.execute(query, params)
    events = result.fetchall()
    
    return [get_event_with_participants(e, db) for e in events]


def get_event_with_participants(event, db: Session) -> EventWithParticipants:
    """Fetch event with participants."""
    # Get participants with user info
    p_result = db.execute(
        text("""
        SELECT p.user_id, p.event_id, p.role, p.response, p.created_at,
               u.name, u.email
        FROM Participant p
        LEFT JOIN User u ON p.user_id = u.user_id
        WHERE p.event_id = :event_id
        """),
        {"event_id": event.event_id}
    )
    participants = p_result.fetchall()

    return EventWithParticipants(
        event_id=event.event_id,
        creator_id=event.creator_id,
        title=event.title,
        description=event.description,
        priority=event.priority,
        start_time=event.start_time,
        end_time=event.end_time,
        status=EventStatus(event.status),
        estimated_duration=event.estimated_duration,
        created_at=event.created_at,
        updated_at=event.updated_at,
        participants=[
            {
                "user_id": p.user_id,
                "event_id": p.event_id,
                "role": p.role,
                "response": p.response,
                "created_at": p.created_at,
                "user": {
                    "name": p.name,
                    "email": p.email
                } if p.name else None
            }
            for p in participants
        ]
    )


@router.get("/{event_id}", response_model=EventWithParticipants)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get event details by ID."""
    result = db.execute(
        text("""
        SELECT event_id, creator_id, title, description, priority,
               start_time, end_time, status, estimated_duration, created_at, updated_at
        FROM Event
        WHERE event_id = :id
        """),
        {"id": event_id}
    )
    event = result.fetchone()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is participant
    p_result = db.execute(
        text("SELECT 1 FROM Participant WHERE event_id = :id AND user_id = :uid"),
        {"id": event_id, "uid": user_id}
    )
    if not p_result.fetchone() and event.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this event"
        )
    
    return get_event_with_participants(event, db)


@router.post("", response_model=EventWithParticipants, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Create a new event/todo."""
    # Call stored procedure
    result = db.execute(
        text("""
        CALL sp_create_event(
            :creator_id, :title, :description, :priority,
            :start_time, :end_time, :status, :estimated_duration, @event_id
        )
        """),
        {
            "creator_id": user_id,
            "title": event_data.title,
            "description": event_data.description,
            "priority": event_data.priority,
            "start_time": event_data.start_time,
            "end_time": event_data.end_time,
            "status": event_data.status.value if event_data.status else None,
            "estimated_duration": event_data.estimated_duration
        }
    )

    # Get the created event ID BEFORE committing
    result = db.execute(text("SELECT @event_id AS event_id"))
    event_id = result.fetchone().event_id

    # Add participants if provided
    for participant_id in event_data.participant_ids or []:
        db.execute(
            text("""
            CALL sp_add_participant(:event_id, :user_id, 'required', @success, @message)
            """),
            {"event_id": event_id, "user_id": participant_id}
        )

    db.commit()
    
    # Fetch and return the created event
    return get_event(event_id, db, user_id)


@router.put("/{event_id}", response_model=EventWithParticipants)
def update_event(
    event_id: int,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Update an event."""
    # Check ownership
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
            detail="Only the creator can update this event"
        )
    
    # Call stored procedure
    db.execute(
        text("""
        CALL sp_update_event(
            :event_id, :title, :description, :priority,
            :start_time, :end_time, :status, :estimated_duration,
            @success, @message
        )
        """),
        {
            "event_id": event_id,
            "title": event_data.title,
            "description": event_data.description,
            "priority": event_data.priority,
            "start_time": event_data.start_time,
            "end_time": event_data.end_time,
            "status": event_data.status.value if event_data.status else None,
            "estimated_duration": event_data.estimated_duration
        }
    )

    # Check result BEFORE committing
    result = db.execute(text("SELECT @success AS success, @message AS message"))
    row = result.fetchone()

    db.commit()

    if not row.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=row.message
        )

    return get_event(event_id, db, user_id)


@router.post("/{event_id}/schedule", response_model=EventWithParticipants)
def schedule_event(
    event_id: int,
    schedule_data: EventSchedule,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Schedule a todo (set start and end time)."""
    # Call stored procedure
    result = db.execute(
        text("""
        CALL sp_schedule_todo(
            :event_id, :start_time, :end_time, @success, @message
        )
        """),
        {
            "event_id": event_id,
            "start_time": schedule_data.start_time,
            "end_time": schedule_data.end_time
        }
    )

    # Check result BEFORE committing
    result = db.execute(text("SELECT @success AS success, @message AS message"))
    row = result.fetchone()

    db.commit()

    if not row.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=row.message
        )
    
    return get_event(event_id, db, user_id)


@router.post("/{event_id}/cancel", response_model=APIResponse)
def cancel_event(
    event_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Cancel an event (soft delete)."""
    result = db.execute(
        text("CALL sp_cancel_event(:event_id, @success, @message)"),
        {"event_id": event_id}
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


@router.delete("/{event_id}", response_model=APIResponse)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Delete an event (hard delete, creator only)."""
    result = db.execute(
        text("CALL sp_delete_event(:event_id, :user_id, @success, @message)"),
        {"event_id": event_id, "user_id": user_id}
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
