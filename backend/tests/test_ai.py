"""
AI service tests.

These tests verify the natural language parser and scheduler services.
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from sqlalchemy import text

from app.services.nl_parser import parse_natural_language
from app.services.scheduler import auto_schedule_events, find_available_slots
from app.schemas import ParsedEvent


class TestNaturalLanguageParser:
    """Test natural language parsing service."""
    
    @pytest.mark.skip(reason="Requires OpenAI API key")
    def test_parse_simple_event(self):
        """Test parsing a simple event description."""
        text = "Team meeting tomorrow at 2pm for 1 hour"
        events = parse_natural_language(text)
        
        assert len(events) == 1
        assert "meeting" in events[0].title.lower()
        assert events[0].estimated_duration == 60
    
    @pytest.mark.skip(reason="Requires OpenAI API key")
    def test_parse_multiple_events(self):
        """Test parsing multiple events from text."""
        text = """
        I need to:
        - Have a 30-min standup with the team
        - Review PR #123 (should take about 1 hour)
        - Lunch with Sarah at noon
        """
        events = parse_natural_language(text)
        
        assert len(events) >= 2
        titles = [e.title.lower() for e in events]
        assert any("standup" in t for t in titles)
        assert any("review" in t for t in titles)
    
    @pytest.mark.skip(reason="Requires OpenAI API key")
    def test_parse_with_participants(self):
        """Test parsing events with participant emails."""
        text = "Meeting with john@example.com and sarah@example.com"
        events = parse_natural_language(text)
        
        assert len(events) == 1
        assert len(events[0].participant_emails) >= 1
    
    @pytest.mark.skip(reason="Requires OpenAI API key")
    def test_parse_priority_inference(self):
        """Test that priority is inferred from context."""
        urgent_text = "URGENT: Submit tax report by end of day"
        normal_text = "Maybe read that article sometime"
        
        urgent_events = parse_natural_language(urgent_text)
        normal_events = parse_natural_language(normal_text)
        
        assert urgent_events[0].priority <= 2  # High priority
        assert normal_events[0].priority >= 4  # Low priority
    
    def test_parse_fallback_without_api(self):
        """Test behavior when OpenAI API is not available."""
        # This tests that the function raises an appropriate error
        with patch('app.services.nl_parser.settings.OPENAI_API_KEY', None):
            with pytest.raises(Exception) as exc_info:
                parse_natural_language("Test event")
            assert "OpenAI API key not configured" in str(exc_info.value)


class TestScheduler:
    """Test auto-scheduling service."""
    
    def test_auto_schedule_single_event(self, db_session, test_user):
        """Test scheduling a single event."""
        # Create unscheduled event
        result = db_session.execute(
            text("""
                INSERT INTO Event (creator_id, title, priority, status, estimated_duration)
                VALUES (:creator_id, 'Test TODO', 2, 'unscheduled', 60)
            """),
            {"creator_id": test_user["user_id"]}
        )
        db_session.commit()
        event_id = result.lastrowid
        
        # Auto-schedule
        range_start = datetime(2026, 3, 27, 9, 0)
        range_end = datetime(2026, 3, 27, 18, 0)
        
        result = auto_schedule_events(
            db=db_session,
            event_ids=[event_id],
            range_start=range_start,
            range_end=range_end,
            user_id=test_user["user_id"]
        )
        
        assert result.success is True
        assert result.scheduled_count >= 1
        
        # Verify event was scheduled
        event_result = db_session.execute(
            text("SELECT status, start_time FROM Event WHERE event_id = :id"),
            {"id": event_id}
        )
        event = event_result.fetchone()
        assert event.status == "scheduled"
        assert event.start_time is not None
        
        # Cleanup
        db_session.execute(text("DELETE FROM Event WHERE event_id = :id"), {"id": event_id})
        db_session.commit()
    
    def test_auto_schedule_respects_existing_events(self, db_session, test_user):
        """Test that auto-schedule doesn't conflict with existing events."""
        # Create existing scheduled event at 10am
        result = db_session.execute(
            text("""
                INSERT INTO Event (creator_id, title, priority, status, start_time, end_time)
                VALUES (:creator_id, 'Existing Meeting', 2, 'scheduled', :start, :end)
            """),
            {
                "creator_id": test_user["user_id"],
                "start": datetime(2026, 3, 27, 10, 0),
                "end": datetime(2026, 3, 27, 11, 0)
            }
        )
        db_session.commit()
        existing_id = result.lastrowid
        
        # Create unscheduled event to schedule
        result = db_session.execute(
            text("""
                INSERT INTO Event (creator_id, title, priority, status, estimated_duration)
                VALUES (:creator_id, 'New TODO', 2, 'unscheduled', 60)
            """),
            {"creator_id": test_user["user_id"]}
        )
        db_session.commit()
        new_id = result.lastrowid
        
        # Auto-schedule
        range_start = datetime(2026, 3, 27, 9, 0)
        range_end = datetime(2026, 3, 27, 12, 0)
        
        result = auto_schedule_events(
            db=db_session,
            event_ids=[new_id],
            range_start=range_start,
            range_end=range_end,
            user_id=test_user["user_id"]
        )
        
        assert result.success is True
        
        # Verify new event was scheduled (should be at 9am or 11am, not 10am)
        event_result = db_session.execute(
            text("SELECT start_time, end_time FROM Event WHERE event_id = :id"),
            {"id": new_id}
        )
        event = event_result.fetchone()
        
        # Should not overlap with existing meeting
        assert not (event.start_time < datetime(2026, 3, 27, 11, 0) and 
                    event.end_time > datetime(2026, 3, 27, 10, 0))
        
        # Cleanup
        db_session.execute(text("DELETE FROM Event WHERE event_id IN (:id1, :id2)"), 
                          {"id1": existing_id, "id2": new_id})
        db_session.commit()
    
    def test_auto_schedule_priority_override(self, db_session, test_user):
        """Test that higher priority events override lower priority."""
        # Create low priority scheduled event
        result = db_session.execute(
            text("""
                INSERT INTO Event (creator_id, title, priority, status, start_time, end_time)
                VALUES (:creator_id, 'Low Priority', 4, 'scheduled', :start, :end)
            """),
            {
                "creator_id": test_user["user_id"],
                "start": datetime(2026, 3, 27, 10, 0),
                "end": datetime(2026, 3, 27, 11, 0)
            }
        )
        db_session.commit()
        low_id = result.lastrowid
        
        # Create high priority unscheduled event
        result = db_session.execute(
            text("""
                INSERT INTO Event (creator_id, title, priority, status, estimated_duration)
                VALUES (:creator_id, 'High Priority', 1, 'unscheduled', 60)
            """),
            {"creator_id": test_user["user_id"]}
        )
        db_session.commit()
        high_id = result.lastrowid
        
        # Auto-schedule high priority event
        range_start = datetime(2026, 3, 27, 9, 0)
        range_end = datetime(2026, 3, 27, 12, 0)
        
        result = auto_schedule_events(
            db=db_session,
            event_ids=[high_id],
            range_start=range_start,
            range_end=range_end,
            user_id=test_user["user_id"]
        )
        
        assert result.success is True
        
        # Verify high priority event was scheduled
        high_result = db_session.execute(
            text("SELECT status FROM Event WHERE event_id = :id"),
            {"id": high_id}
        )
        assert high_result.fetchone().status == "scheduled"
        
        # Verify low priority event was bumped
        low_result = db_session.execute(
            text("SELECT status, start_time FROM Event WHERE event_id = :id"),
            {"id": low_id}
        )
        low_event = low_result.fetchone()
        assert low_event.status == "unscheduled"
        assert low_event.start_time is None
        
        # Cleanup
        db_session.execute(text("DELETE FROM Event WHERE event_id IN (:id1, :id2)"), 
                          {"id1": low_id, "id2": high_id})
        db_session.commit()


class TestFindAvailableSlots:
    """Test the find_available_slots helper function."""
    
    def test_find_slots_no_events(self, db_session, test_user):
        """Test finding slots when no events exist."""
        date = datetime(2026, 3, 27)
        slots = find_available_slots(
            db=db_session,
            user_id=test_user["user_id"],
            date=date,
            duration_minutes=60
        )
        
        # Should have multiple slots throughout the day
        assert len(slots) > 0
    
    def test_find_slots_with_events(self, db_session, test_user):
        """Test finding slots around existing events."""
        # Create existing event at 10am-11am
        result = db_session.execute(
            text("""
                INSERT INTO Event (creator_id, title, priority, status, start_time, end_time)
                VALUES (:creator_id, 'Meeting', 2, 'scheduled', :start, :end)
            """),
            {
                "creator_id": test_user["user_id"],
                "start": datetime(2026, 3, 27, 10, 0),
                "end": datetime(2026, 3, 27, 11, 0)
            }
        )
        db_session.commit()
        
        date = datetime(2026, 3, 27)
        slots = find_available_slots(
            db=db_session,
            user_id=test_user["user_id"],
            date=date,
            duration_minutes=60
        )
        
        # Should have slots before and/or after the meeting
        assert len(slots) > 0
        
        # None should overlap with the meeting
        for start, end in slots:
            assert not (start < datetime(2026, 3, 27, 11, 0) and 
                       end > datetime(2026, 3, 27, 10, 0))
