"""
Auto-Scheduler Service

Orchestrates the auto-scheduling of events by calling the database stored procedure.
"""

from datetime import datetime
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..schemas import AutoScheduleResponse


def auto_schedule_events(
    db: Session,
    event_ids: List[int],
    range_start: datetime,
    range_end: datetime,
    user_id: int
) -> AutoScheduleResponse:
    """
    Auto-schedule multiple events within a time range.
    
    This function calls the database stored procedure sp_auto_schedule
    which handles the actual scheduling logic including:
    - Finding available time slots
    - Checking for conflicts
    - Overriding lower priority events
    - Respecting participant availability
    
    Args:
        db: Database session
        event_ids: List of unscheduled event IDs to schedule
        range_start: Start of the scheduling window
        range_end: End of the scheduling window
        user_id: ID of the user requesting the schedule
        
    Returns:
        AutoScheduleResponse with success status and details
    """
    try:
        # Convert event_ids to comma-separated string for the stored procedure
        event_ids_str = ",".join(str(eid) for eid in event_ids)
        
        # Call the stored procedure
        db.execute(
            text("""
                CALL sp_auto_schedule(
                    :event_ids, :range_start, :range_end, :user_id, 
                    @success, @message
                )
            """),
            {
                "event_ids": event_ids_str,
                "range_start": range_start,
                "range_end": range_end,
                "user_id": user_id
            }
        )
        db.commit()
        
        # Get the result
        result = db.execute(
            text("SELECT @success AS success, @message AS message")
        )
        row = result.fetchone()
        
        if row is None:
            return AutoScheduleResponse(
                success=False,
                message="Stored procedure did not return a result"
            )
        
        # Parse the message to extract scheduled count and overridden events
        message = row.message or ""
        scheduled_count = 0
        overridden_events = []
        
        # Try to extract scheduled count
        import re
        count_match = re.search(r"Scheduled (\d+) events", message)
        if count_match:
            scheduled_count = int(count_match.group(1))
        
        # Try to extract overridden events
        override_match = re.search(r"Overridden events: ([\d,]+)", message)
        if override_match:
            overridden_events = [int(x) for x in override_match.group(1).split(",")]
        
        return AutoScheduleResponse(
            success=row.success if row.success else False,
            message=message,
            scheduled_count=scheduled_count,
            overridden_events=overridden_events if overridden_events else None
        )
        
    except Exception as e:
        db.rollback()
        return AutoScheduleResponse(
            success=False,
            message=f"Failed to schedule events: {str(e)}",
            scheduled_count=0
        )


def find_available_slots(
    db: Session,
    user_id: int,
    date: datetime,
    duration_minutes: int,
    working_hours_start: int = 9,
    working_hours_end: int = 18
) -> List[Tuple[datetime, datetime]]:
    """
    Find available time slots for a user on a given date.
    
    This is a helper function that can be used for more advanced
    scheduling logic if needed.
    
    Args:
        db: Database session
        user_id: User ID to check availability
        date: Date to check
        duration_minutes: Required duration in minutes
        working_hours_start: Start of working hours (default: 9 AM)
        working_hours_end: End of working hours (default: 6 PM)
        
    Returns:
        List of (start, end) tuples representing available slots
    """
    # Get all scheduled events for the user on that date
    result = db.execute(
        text("""
            SELECT e.start_time, e.end_time
            FROM Event e
            INNER JOIN Participant p ON e.event_id = p.event_id
            WHERE p.user_id = :user_id
              AND e.status = 'scheduled'
              AND DATE(e.start_time) = DATE(:date)
            ORDER BY e.start_time
        """),
        {"user_id": user_id, "date": date}
    )
    
    events = result.fetchall()
    
    # Generate potential slots
    from datetime import timedelta
    slots = []
    
    day_start = datetime(date.year, date.month, date.day, working_hours_start, 0)
    day_end = datetime(date.year, date.month, date.day, working_hours_end, 0)
    
    current_time = day_start
    
    for event in events:
        if event.start_time and event.end_time:
            # Check if there's room before this event
            if current_time + timedelta(minutes=duration_minutes) <= event.start_time:
                slots.append((current_time, current_time + timedelta(minutes=duration_minutes)))
            
            # Move current time to after this event
            current_time = max(current_time, event.end_time)
    
    # Check if there's room after the last event
    if current_time + timedelta(minutes=duration_minutes) <= day_end:
        slots.append((current_time, current_time + timedelta(minutes=duration_minutes)))
    
    return slots
