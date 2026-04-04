"""
Pytest fixtures for backend tests.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import get_db, engine
from app.config import settings
from app.auth import create_access_token
from datetime import timedelta


# Test database configuration (use separate test database)
TEST_DB_CONFIG = {
    "host": settings.DB_HOST,
    "port": settings.DB_PORT,
    "name": "calendar_test",
    "user": settings.DB_USER,
    "password": settings.DB_PASSWORD
}


@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine."""
    test_engine = create_engine(
        f"mysql+pymysql://{TEST_DB_CONFIG['user']}:{TEST_DB_CONFIG['password']}@"
        f"{TEST_DB_CONFIG['host']}:{TEST_DB_CONFIG['port']}/{TEST_DB_CONFIG['name']}",
        pool_pre_ping=True,
    )
    yield test_engine
    test_engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine):
    """Create a fresh database session for each test."""
    # Create tables
    with test_engine.connect() as conn:
        # Run schema
        schema_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "scripts", "schema.sql"
        )
        if os.path.exists(schema_path):
            with open(schema_path, 'r') as f:
                schema_sql = f.read()
            # Execute each statement separately (handle DELIMITER)
            statements = schema_sql.split(';')
            for stmt in statements:
                stmt = stmt.strip()
                if stmt and not stmt.startswith('DELIMITER'):
                    try:
                        conn.execute(text(stmt))
                    except Exception:
                        pass  # Ignore errors (e.g., table already exists)
            conn.commit()
    
    # Create session
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=test_engine
    )
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.close()
        # Cleanup
        with test_engine.connect() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            for table in ["Log", "Participant", "Event", "User"]:
                try:
                    conn.execute(text(f"TRUNCATE TABLE {table}"))
                except Exception:
                    pass
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            conn.commit()


@pytest.fixture(scope="function")
def client(db_session):
    """Create test client with database override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db_session):
    """Create a test user."""
    result = db_session.execute(
        text("INSERT INTO User (name, email) VALUES (:name, :email)"),
        {"name": "Test User", "email": "test@example.com"}
    )
    db_session.commit()
    user_id = result.lastrowid
    
    yield {"user_id": user_id, "name": "Test User", "email": "test@example.com"}
    
    # Cleanup
    db_session.execute(text("DELETE FROM User WHERE user_id = :id"), {"id": user_id})
    db_session.commit()


@pytest.fixture(scope="function")
def test_user2(db_session):
    """Create a second test user."""
    result = db_session.execute(
        text("INSERT INTO User (name, email) VALUES (:name, :email)"),
        {"name": "Test User 2", "email": "test2@example.com"}
    )
    db_session.commit()
    user_id = result.lastrowid
    
    yield {"user_id": user_id, "name": "Test User 2", "email": "test2@example.com"}
    
    # Cleanup
    db_session.execute(text("DELETE FROM User WHERE user_id = :id"), {"id": user_id})
    db_session.commit()


@pytest.fixture(scope="function")
def auth_token(test_user):
    """Create a valid JWT token for test user."""
    token = create_access_token(
        data={"sub": test_user["user_id"]},
        expires_delta=timedelta(minutes=30)
    )
    return f"Bearer {token}"


@pytest.fixture(scope="function")
def test_event(db_session, test_user):
    """Create a test event."""
    result = db_session.execute(
        text("""
            INSERT INTO Event (creator_id, title, description, priority, status)
            VALUES (:creator_id, :title, :description, :priority, :status)
        """),
        {
            "creator_id": test_user["user_id"],
            "title": "Test Event",
            "description": "Test Description",
            "priority": 3,
            "status": "unscheduled"
        }
    )
    db_session.commit()
    event_id = result.lastrowid
    
    # Add creator as participant
    db_session.execute(
        text("""
            INSERT INTO Participant (user_id, event_id, role, response)
            VALUES (:user_id, :event_id, 'organizer', 'accepted')
        """),
        {"user_id": test_user["user_id"], "event_id": event_id}
    )
    db_session.commit()
    
    yield {"event_id": event_id, "title": "Test Event", "creator_id": test_user["user_id"]}
    
    # Cleanup
    db_session.execute(text("DELETE FROM Event WHERE event_id = :id"), {"id": event_id})
    db_session.commit()
