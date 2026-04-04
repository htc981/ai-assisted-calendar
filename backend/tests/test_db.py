"""
Database stored procedure tests.

These tests verify the database-level business logic.
"""

import pytest
from sqlalchemy import text
from datetime import datetime, timedelta


class TestStoredProcedures:
    """Test database stored procedures."""
    
    def test_sp_create_event(self, db_session, test_user):
        """Test creating an event via stored procedure."""
        # Call stored procedure
        result = db_session.execute(
            text("""
                CALL sp_create_event(
                    :creator_id, :title, :description, :priority, 
                    NULL, NULL, 'unscheduled', 60, @event_id
                )
            """),
            {
                "creator_id": test_user["user_id"],
                "title": "Test TODO",
                "description": "Test Description",
                "priority": 2
            }
        )
        db_session.commit()
        
        # Get created event ID
        result = db_session.execute(text("SELECT @event_id AS event_id"))
        event_id = result.fetchone().event_id
        
        # Verify event was created
        result = db_session.execute(
            text("SELECT * FROM Event WHERE event_id = :id"),
            {"id": event_id}
        )
        event = result.fetchone()
        
        assert event is not None
        assert event.title == "Test TODO"
        assert event.priority == 2
        assert event.status == "unscheduled"
        assert event.creator_id == test_user["user_id"]
        
        # Verify creator was added as participant
        result = db_session.execute(
            text("SELECT * FROM Participant WHERE event_id = :id"),
            {"id": event_id}
        )
        participant = result.fetchone()
        assert participant is not None
        assert participant.role == "organizer"
        assert participant.response == "accepted"
        
        # Cleanup
        db_session.execute(text("DELETE FROM Event WHERE event_id = :id"), {"id": event_id})
        db_session.commit()
    
    def test_sp_add_participant(self, db_session, test_event, test_user2):
        """Test adding a participant via stored procedure."""
        # Call stored procedure
        db_session.execute(
            text("""
                CALL sp_add_participant(:event_id, :user_id, 'required', @success, @message)
            """),
            {"event_id": test_event["event_id"], "user_id": test_user2["user_id"]}
        )
        db_session.commit()
        
        # Verify participant was added
        result = db_session.execute(
            text("SELECT * FROM Participant WHERE event_id = :eid AND user_id = :uid"),
            {"eid": test_event["event_id"], "uid": test_user2["user_id"]}
        )
        participant = result.fetchone()
        
        assert participant is not None
        assert participant.role == "required"
        assert participant.response == "pending"
    
    def test_sp_update_participant_response(self, db_session, test_event, test_user2):
        """Test updating participant response."""
        # First add participant
        db_session.execute(
            text("""
                CALL sp_add_participant(:event_id, :user_id, 'required', @success, @message)
            """),
            {"event_id": test_event["event_id"], "user_id": test_user2["user_id"]}
        )
        db_session.commit()
        
        # Update response
        db_session.execute(
            text("""
                CALL sp_update_participant_response(
                    :event_id, :user_id, 'accepted', @success, @message
                )
            """),
            {"event_id": test_event["event_id"], "user_id": test_user2["user_id"]}
        )
        db_session.commit()
        
        # Verify response was updated
        result = db_session.execute(
            text("SELECT response FROM Participant WHERE event_id = :eid AND user_id = :uid"),
            {"eid": test_event["event_id"], "uid": test_user2["user_id"]}
        )
        response = result.fetchone().response
        assert response == "accepted"
    
    def test_sp_schedule_todo(self, db_session, test_event, test_user):
        """Test scheduling a todo."""
        start_time = datetime(2026, 3, 27, 10, 0)
        end_time = datetime(2026, 3, 27, 11, 0)
        
        # Call stored procedure
        db_session.execute(
            text("""
                CALL sp_schedule_todo(:event_id, :start, :end, @success, @message)
            """),
            {"event_id": test_event["event_id"], "start": start_time, "end": end_time}
        )
        db_session.commit()
        
        # Verify event was scheduled
        result = db_session.execute(
            text("SELECT status, start_time, end_time FROM Event WHERE event_id = :id"),
            {"id": test_event["event_id"]}
        )
        event = result.fetchone()
        
        assert event.status == "scheduled"
        assert event.start_time == start_time
        assert event.end_time == end_time
    
    def test_sp_schedule_conflict_override(self, db_session, test_user):
        """Test that higher priority events override lower priority events."""
        # Create low priority scheduled event
        result = db_session.execute(
            text("""
                CALL sp_create_event(
                    :creator_id, 'Low Priority Meeting', 'Description', 4, 
                    :start, :end, 'scheduled', 60, @event_id
                )
            """),
            {
                "creator_id": test_user["user_id"],
                "start": datetime(2026, 3, 27, 10, 0),
                "end": datetime(2026, 3, 27, 11, 0)
            }
        )
        db_session.commit()
        low_priority_id = result.lastrowid
        
        # Create high priority unscheduled event
        result = db_session.execute(
            text("""
                CALL sp_create_event(
                    :creator_id, 'High Priority Meeting', 'Description', 1, 
                    NULL, NULL, 'unscheduled', 60, @event_id2
                )
            """),
            {"creator_id": test_user["user_id"]}
        )
        db_session.commit()
        high_priority_id = result.lastrowid
        
        # Try to schedule high priority event at same time
        db_session.execute(
            text("""
                CALL sp_schedule_todo(:event_id, :start, :end, @success, @message)
            """),
            {
                "event_id": high_priority_id,
                "start": datetime(2026, 3, 27, 10, 0),
                "end": datetime(2026, 3, 27, 11, 0)
            }
        )
        db_session.commit()
        
        # Verify high priority event was scheduled
        result = db_session.execute(
            text("SELECT status FROM Event WHERE event_id = :id"),
            {"id": high_priority_id}
        )
        assert result.fetchone().status == "scheduled"
        
        # Verify low priority event was set back to unscheduled
        result = db_session.execute(
            text("SELECT status, start_time, end_time FROM Event WHERE event_id = :id"),
            {"id": low_priority_id}
        )
        event = result.fetchone()
        assert event.status == "unscheduled"
        assert event.start_time is None
        assert event.end_time is None
        
        # Cleanup
        db_session.execute(text("DELETE FROM Event WHERE event_id IN (:id1, :id2)"), 
                          {"id1": low_priority_id, "id2": high_priority_id})
        db_session.commit()
    
    def test_sp_cancel_event(self, db_session, test_event):
        """Test cancelling an event."""
        # Call stored procedure
        db_session.execute(
            text("CALL sp_cancel_event(:event_id, @success, @message)"),
            {"event_id": test_event["event_id"]}
        )
        db_session.commit()
        
        # Verify event was cancelled
        result = db_session.execute(
            text("SELECT status FROM Event WHERE event_id = :id"),
            {"id": test_event["event_id"]}
        )
        assert result.fetchone().status == "cancelled"
    
    def test_logging_triggers(self, db_session, test_user):
        """Test that logging triggers work correctly."""
        # Create event
        result = db_session.execute(
            text("""
                CALL sp_create_event(
                    :creator_id, 'Test Event', 'Description', 3, 
                    NULL, NULL, 'unscheduled', 60, @event_id
                )
            """),
            {"creator_id": test_user["user_id"]}
        )
        db_session.commit()
        event_id = result.lastrowid
        
        # Check log was created
        result = db_session.execute(
            text("SELECT * FROM Log WHERE event_id = :id ORDER BY log_id DESC LIMIT 1"),
            {"id": event_id}
        )
        log = result.fetchone()
        
        assert log is not None
        assert "Test Event" in log.message
        assert log.action_type == "EVENT_CREATE"
        assert log.user_id == test_user["user_id"]
        
        # Cleanup
        db_session.execute(text("DELETE FROM Event WHERE event_id = :id"), {"id": event_id})
        db_session.commit()
