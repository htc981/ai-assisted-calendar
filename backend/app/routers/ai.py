from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from datetime import datetime
from ..database import get_db
from ..schemas import (
    NLParseRequest, NLParseResponse, ParsedEvent,
    AutoScheduleRequest, AutoScheduleResponse, EventWithParticipants, EventStatus
)
from ..auth import verify_token
from fastapi import Header
from ..services.nl_parser import parse_natural_language
from ..services.scheduler import auto_schedule_events

router = APIRouter(prefix="/api/ai", tags=["AI Services"])


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


@router.post("/parse", response_model=NLParseResponse)
def parse_events(
    request: NLParseRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Parse natural language text into structured events."""
    try:
        parsed_events = parse_natural_language(request.text)
        return {"events": parsed_events}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse events: {str(e)}"
        )


@router.post("/schedule", response_model=AutoScheduleResponse)
def schedule_events(
    request: AutoScheduleRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Auto-schedule multiple events within a time range."""
    try:
        # Verify all events belong to user and are unscheduled
        for event_id in request.event_ids:
            result = db.execute(
                text("""
                SELECT status, creator_id FROM Event
                WHERE event_id = :id
                """),
                {"id": event_id}
            )
            event = result.fetchone()
            
            if not event:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Event {event_id} not found"
                )
            
            if event.creator_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Not authorized to schedule event {event_id}"
                )
            
            if event.status != "unscheduled":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Event {event_id} is not unscheduled (current: {event.status})"
                )
        
        # Call auto-schedule service
        result = auto_schedule_events(
            db=db,
            event_ids=request.event_ids,
            range_start=request.range_start,
            range_end=request.range_end,
            user_id=user_id
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to schedule events: {str(e)}"
        )


@router.post("/create-from-nl", response_model=List[EventWithParticipants])
def create_events_from_nl(
    request: NLParseRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Parse natural language and create events directly."""
    try:
        # Parse the natural language
        parsed_events = parse_natural_language(request.text)
        
        created_events = []
        
        for parsed in parsed_events:
            # Find participant IDs from emails
            participant_ids = []
            if parsed.participant_emails:
                for email in parsed.participant_emails:
                    result = db.execute(
                        text("SELECT user_id FROM User WHERE email = :email"),
                        {"email": email}
                    )
                    user = result.fetchone()
                    if user:
                        participant_ids.append(user.user_id)
            
            # Create event using stored procedure
            db.execute(
                text("""
                CALL sp_create_event(
                    :creator_id, :title, :description, :priority,
                    NULL, NULL, 'unscheduled', :estimated_duration, @event_id
                )
                """),
                {
                    "creator_id": user_id,
                    "title": parsed.title,
                    "description": parsed.description or parsed.time_preferences,
                    "priority": parsed.priority,
                    "estimated_duration": parsed.estimated_duration
                }
            )

            # Get event ID BEFORE committing
            result = db.execute(text("SELECT @event_id AS event_id"))
            event_id = result.fetchone().event_id

            db.commit()
            
            # Add participants
            for pid in participant_ids:
                db.execute(
                    text("""
                    CALL sp_add_participant(:event_id, :user_id, 'required', @success, @message)
                    """),
                    {"event_id": event_id, "user_id": pid}
                )

            db.commit()

            # Fetch created event
            result = db.execute(
                text("""
                SELECT event_id, creator_id, title, description, priority,
                       start_time, end_time, status, estimated_duration, created_at, updated_at
                FROM Event WHERE event_id = :id
                """),
                {"id": event_id}
            )
            event = result.fetchone()
            
            # Get participants
            p_result = db.execute(
                text("SELECT user_id, event_id, role, response, created_at FROM Participant WHERE event_id = :id"),
                {"id": event_id}
            )
            participants = p_result.fetchall()
            
            created_events.append(
                EventWithParticipants(
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
                            "created_at": p.created_at
                        }
                        for p in participants
                    ]
                )
            )
        
        return created_events
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create events from natural language: {type(e)} {str(e)}"
        )
