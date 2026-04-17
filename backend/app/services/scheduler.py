"""
Auto-Scheduler Service

Provides both LLM-based and deterministic scheduling.
"""

from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..schemas import AutoScheduleResponse
from ..config import settings
import re


def auto_schedule_events(
    db: Session,
    event_ids: List[int],
    range_start: datetime,
    range_end: datetime,
    user_id: int
) -> AutoScheduleResponse:
    """
    Auto-schedule multiple events within a time range.
    
    Tries LLM-based scheduling first, falls back to deterministic method.
    """
    # Try LLM-based scheduling first
    try:
        if settings.OPENAI_API_KEY:
            result = auto_schedule_with_llm(
                db=db,
                event_ids=event_ids,
                range_start=range_start,
                range_end=range_end,
                user_id=user_id
            )
            if result and result.success:
                return result
    except Exception as e:
        # Log error and fall back to deterministic
        print(f"[Scheduler] LLM scheduling failed: {e}, falling back to deterministic")
    
    # Fall back to deterministic scheduling
    return auto_schedule_deterministic(
        db=db,
        event_ids=event_ids,
        range_start=range_start,
        range_end=range_end,
        user_id=user_id
    )


def auto_schedule_with_llm(
    db: Session,
    event_ids: List[int],
    range_start: datetime,
    range_end: datetime,
    user_id: int
) -> Optional[AutoScheduleResponse]:
    """
    Schedule events using LLM to find optimal time slots.
    
    Returns None if LLM scheduling should not be used.
    """
    try:
        from openai import OpenAI
        
        if not settings.OPENAI_API_KEY:
            return None
        
        # Get event details
        events_data = []
        for event_id in event_ids:
            result = db.execute(
                text("""
                SELECT event_id, title, description, priority, estimated_duration
                FROM Event
                WHERE event_id = :id
                """),
                {"id": event_id}
            )
            event = result.fetchone()
            if event:
                events_data.append({
                    "id": event.event_id,
                    "title": event.title,
                    "description": event.description or "",
                    "priority": event.priority,
                    "duration": event.estimated_duration or 60
                })
        
        if not events_data:
            return None
        
        # Get existing scheduled events for context
        existing_result = db.execute(
            text("""
            SELECT event_id, title, start_time, end_time, priority
            FROM Event
            WHERE creator_id = :user_id
              AND status = 'scheduled'
              AND start_time IS NOT NULL
              AND end_time IS NOT NULL
            """),
            {"user_id": user_id}
        )
        existing_events = [
            {
                "title": row.title,
                "start": row.start_time.isoformat() if row.start_time else None,
                "end": row.end_time.isoformat() if row.end_time else None,
                "priority": row.priority
            }
            for row in existing_result.fetchall()
        ]
        
        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL
        )
        
        # Build prompt for LLM
        from datetime import datetime
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        prompt = f"""You are a scheduling assistant. Schedule these events optimally.

Current time: {current_time}
All times should be in local timezone.

Events to schedule:
{chr(10).join(f"- ID {e['id']}: '{e['title']}' ({e['duration']}min, priority {e['priority']}){chr(10)    }  Description: {e['description'] or 'N/A'}" for e in events_data)}

Existing commitments:
{chr(10).join(f"- {e['title']}: {e['start']} to {e['end']} (priority {e['priority']})" for e in existing_events) if existing_events else "None"}

Time range: {range_start} to {range_end}

Return JSON with scheduled times for each event. Higher priority (lower number) events get preferred slots.
Avoid conflicts with existing commitments.
Consider event descriptions when scheduling (e.g., "morning meeting" should be in the morning).
Format: {{"schedules": [{{"event_id": 1, "start": "2026-04-17 14:00:00", "end": "2026-04-17 14:30:00"}}]}}"""

        # Retry mechanism for LLM call + re-parse loop
        max_retries = 3
        last_error = None

        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a helpful scheduling assistant. Return only valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=8000
                )

                # Parse LLM response
                content = response.choices[0].message.content.strip()

                print(f"[Scheduler LLM] Attempt {attempt + 1}: {content[:100]}...")

                # Extract JSON from response
                json_match = re.search(r'\{{[\s\S]*\}}', content)
                if not json_match:
                    raise Exception("No JSON found in LLM response")

                import json
                schedule_data = json.loads(json_match.group())

                if "schedules" not in schedule_data:
                    raise Exception("No 'schedules' key in LLM response")

                # Apply the schedule
                scheduled_count = 0
                for schedule in schedule_data["schedules"]:
                    event_id = schedule.get("event_id")
                    start_time = schedule.get("start")
                    end_time = schedule.get("end")

                    if not all([event_id, start_time, end_time]):
                        continue

                    # Schedule the event
                    result = db.execute(
                        text("""
                        CALL sp_schedule_todo(
                            :event_id, :start_time, :end_time, @success, @message
                        )
                        """),
                        {
                            "event_id": event_id,
                            "start_time": start_time,
                            "end_time": end_time
                        }
                    )

                    check_result = db.execute(text("SELECT @success AS success, @message AS message"))
                    row = check_result.fetchone()

                    if row and row.success:
                        scheduled_count += 1

                db.commit()

                return AutoScheduleResponse(
                    success=True,
                    message=f"Scheduled {scheduled_count} events using AI",
                    scheduled_count=scheduled_count
                )

            except Exception as e:
                last_error = e
                print(f"[Scheduler LLM] Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(0.5 * (attempt + 1))  # Exponential backoff
                continue

        # All retries failed
        print(f"[Scheduler LLM] All {max_retries} attempts failed: {last_error}")
        return None

    except Exception as e:
        print(f"[Scheduler] LLM scheduling error: {e}")
        return None


def auto_schedule_deterministic(
    db: Session,
    event_ids: List[int],
    range_start: datetime,
    range_end: datetime,
    user_id: int
) -> AutoScheduleResponse:
    """
    Schedule events using deterministic database stored procedure.
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
