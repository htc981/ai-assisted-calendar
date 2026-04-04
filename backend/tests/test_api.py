"""
API endpoint tests.

These tests verify the FastAPI endpoints work correctly.
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy import text


class TestAuthEndpoints:
    """Test authentication endpoints."""
    
    def test_register_user(self, client):
        """Test user registration."""
        response = client.post(
            "/api/auth/register",
            json={"name": "New User", "email": "newuser@example.com"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New User"
        assert data["email"] == "newuser@example.com"
        assert "user_id" in data
    
    def test_register_duplicate_email(self, client, test_user):
        """Test registering with duplicate email fails."""
        response = client.post(
            "/api/auth/register",
            json={"name": "Duplicate User", "email": test_user["email"]}
        )
        assert response.status_code == 400
    
    def test_login_existing_user(self, client, test_user):
        """Test login for existing user."""
        response = client.post(
            "/api/auth/login",
            json={"email": test_user["email"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_creates_user(self, client):
        """Test login creates user if not exists."""
        response = client.post(
            "/api/auth/login",
            json={"email": "autocreate@example.com", "name": "Auto Create"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data


class TestUserEndpoints:
    """Test user endpoints."""
    
    def test_get_current_user(self, client, auth_token, test_user):
        """Test getting current user."""
        response = client.get(
            "/api/users/me",
            headers={"Authorization": auth_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == test_user["user_id"]
        assert data["name"] == test_user["name"]
    
    def test_list_users(self, client, auth_token):
        """Test listing users."""
        response = client.get(
            "/api/users",
            headers={"Authorization": auth_token}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_unauthorized_access(self, client):
        """Test unauthorized access fails."""
        response = client.get("/api/users/me")
        assert response.status_code == 401


class TestEventEndpoints:
    """Test event endpoints."""
    
    def test_create_event(self, client, auth_token):
        """Test creating an event."""
        response = client.post(
            "/api/events",
            headers={"Authorization": auth_token},
            json={
                "title": "New Event",
                "description": "Test Description",
                "priority": 2
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Event"
        assert data["priority"] == 2
        assert data["status"] == "unscheduled"
    
    def test_list_events(self, client, auth_token, test_event):
        """Test listing events."""
        response = client.get(
            "/api/events",
            headers={"Authorization": auth_token}
        )
        assert response.status_code == 200
        events = response.json()
        assert len(events) >= 1
    
    def test_get_event(self, client, auth_token, test_event):
        """Test getting a single event."""
        response = client.get(
            f"/api/events/{test_event['event_id']}",
            headers={"Authorization": auth_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["event_id"] == test_event["event_id"]
    
    def test_update_event(self, client, auth_token, test_event):
        """Test updating an event."""
        response = client.put(
            f"/api/events/{test_event['event_id']}",
            headers={"Authorization": auth_token},
            json={"title": "Updated Title", "priority": 1}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["priority"] == 1
    
    def test_schedule_event(self, client, auth_token, test_event):
        """Test scheduling an event."""
        start_time = datetime(2026, 3, 27, 14, 0).isoformat()
        end_time = datetime(2026, 3, 27, 15, 0).isoformat()
        
        response = client.post(
            f"/api/events/{test_event['event_id']}/schedule",
            headers={"Authorization": auth_token},
            json={"start_time": start_time, "end_time": end_time}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "scheduled"
        assert data["start_time"] is not None
    
    def test_cancel_event(self, client, auth_token, test_event):
        """Test cancelling an event."""
        response = client.post(
            f"/api/events/{test_event['event_id']}/cancel",
            headers={"Authorization": auth_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify status changed
        response = client.get(
            f"/api/events/{test_event['event_id']}",
            headers={"Authorization": auth_token}
        )
        assert response.json()["status"] == "cancelled"
    
    def test_delete_event(self, client, auth_token, test_event):
        """Test deleting an event."""
        response = client.delete(
            f"/api/events/{test_event['event_id']}",
            headers={"Authorization": auth_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestParticipantEndpoints:
    """Test participant endpoints."""
    
    def test_add_participant(self, client, auth_token, test_event, test_user2):
        """Test adding a participant."""
        response = client.post(
            f"/api/events/{test_event['event_id']}/participants",
            headers={"Authorization": auth_token},
            json={"user_id": test_user2["user_id"], "role": "required"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    def test_list_participants(self, client, auth_token, test_event):
        """Test listing participants."""
        response = client.get(
            f"/api/events/{test_event['event_id']}/participants",
            headers={"Authorization": auth_token}
        )
        assert response.status_code == 200
        participants = response.json()
        assert len(participants) >= 1  # At least the creator
    
    def test_update_response(self, client, test_event, test_user2):
        """Test updating participant response."""
        # First add user2 as participant
        token_response = client.post(
            "/api/auth/login",
            json={"email": test_user2["email"]}
        )
        token = token_response.json()["access_token"]
        
        client.post(
            f"/api/events/{test_event['event_id']}/participants",
            headers={"Authorization": f"Bearer {token}"},
            json={"user_id": test_user2["user_id"], "role": "required"}
        )
        
        # Update response
        response = client.put(
            f"/api/events/{test_event['event_id']}/participants/{test_user2['user_id']}/response",
            headers={"Authorization": f"Bearer {token}"},
            json={"response": "accepted"}
        )
        assert response.status_code == 200


class TestAIEndpoints:
    """Test AI service endpoints."""
    
    @pytest.mark.skip(reason="Requires OpenAI API key")
    def test_parse_natural_language(self, client, auth_token):
        """Test parsing natural language."""
        response = client.post(
            "/api/ai/parse",
            headers={"Authorization": auth_token},
            json={"text": "Meeting with John tomorrow at 2pm for 1 hour"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert len(data["events"]) > 0
    
    @pytest.mark.skip(reason="Requires OpenAI API key")
    def test_create_from_nl(self, client, auth_token):
        """Test creating events from natural language."""
        response = client.post(
            "/api/ai/create-from-nl",
            headers={"Authorization": auth_token},
            json={"text": "Quick call with team, 30 minutes"}
        )
        assert response.status_code == 200
        events = response.json()
        assert len(events) > 0
    
    def test_auto_schedule(self, client, auth_token, test_event):
        """Test auto-scheduling events."""
        # Create another unscheduled event
        client.post(
            "/api/events",
            headers={"Authorization": auth_token},
            json={"title": "Another TODO", "priority": 2}
        )
        
        # Get event IDs
        response = client.get(
            "/api/events?status=unscheduled",
            headers={"Authorization": auth_token}
        )
        event_ids = [e["event_id"] for e in response.json()]
        
        # Auto-schedule
        range_start = datetime(2026, 3, 27, 9, 0).isoformat()
        range_end = datetime(2026, 3, 27, 18, 0).isoformat()
        
        response = client.post(
            "/api/ai/schedule",
            headers={"Authorization": auth_token},
            json={
                "event_ids": event_ids,
                "range_start": range_start,
                "range_end": range_end
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "message" in data
