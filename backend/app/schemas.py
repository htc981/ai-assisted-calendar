from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


# ============================================================
# Enums
# ============================================================

class EventStatus(str, Enum):
    unscheduled = "unscheduled"
    scheduled = "scheduled"
    cancelled = "cancelled"


class ParticipantRole(str, Enum):
    organizer = "organizer"
    required = "required"
    optional = "optional"


class ParticipantResponseType(str, Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    tentative = "tentative"


# ============================================================
# Token / Auth
# ============================================================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


class UserLogin(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr


# ============================================================
# User
# ============================================================

class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    user_id: int
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================================
# Participant
# ============================================================

class ParticipantBase(BaseModel):
    role: ParticipantRole = ParticipantRole.required


class ParticipantAdd(BaseModel):
    user_id: int
    role: ParticipantRole = ParticipantRole.required


class ParticipantResponse(BaseModel):
    user_id: int
    event_id: int
    role: ParticipantRole
    response: ParticipantResponseType
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ParticipantUpdateResponse(BaseModel):
    response: ParticipantResponseType


# ============================================================
# Event
# ============================================================

class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: int = Field(default=3, ge=1, le=5)  # 1 = Urgent (highest), 5 = Optional (lowest)


class EventCreate(EventBase):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[EventStatus] = None
    estimated_duration: Optional[int] = Field(default=None, ge=5)  # minutes
    participant_ids: Optional[List[int]] = []

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convert empty strings to None for optional datetime fields."""
        if v == '':
            return None
        return v

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def parse_datetime(cls, v):
        """
        Parse datetime from frontend.
        Accepts ISO format or MySQL format (YYYY-MM-DD HH:MM:SS).
        Frontend sends local time, we store it as-is in MySQL DATETIME.
        """
        if v is None or isinstance(v, datetime):
            return v
        if isinstance(v, str):
            # Try parsing MySQL format first: "2026-03-28 14:00:00"
            try:
                return datetime.strptime(v, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                pass
            # Try ISO format
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                pass
        return v


class EventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Optional[int] = Field(default=None, ge=1, le=5)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[EventStatus] = None
    estimated_duration: Optional[int] = Field(default=None, ge=5)  # minutes

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convert empty strings to None for optional datetime fields."""
        if v == '':
            return None
        return v

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def parse_datetime(cls, v):
        """
        Parse datetime from frontend.
        Accepts ISO format or MySQL format (YYYY-MM-DD HH:MM:SS).
        Frontend sends local time, we store it as-is in MySQL DATETIME.
        """
        if v is None or isinstance(v, datetime):
            return v
        if isinstance(v, str):
            # Try parsing MySQL format first: "2026-03-28 14:00:00"
            try:
                return datetime.strptime(v, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                pass
            # Try ISO format
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                pass
        return v


class EventSchedule(BaseModel):
    start_time: datetime
    end_time: datetime

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def parse_datetime(cls, v):
        """
        Parse datetime from frontend.
        Accepts ISO format or MySQL format (YYYY-MM-DD HH:MM:SS).
        Frontend sends local time, we store it as-is in MySQL DATETIME.
        """
        if v is None or isinstance(v, datetime):
            return v
        if isinstance(v, str):
            # Try parsing MySQL format first: "2026-03-28 14:00:00"
            try:
                return datetime.strptime(v, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                pass
            # Try ISO format
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                pass
        return v


class EventResponse(EventBase):
    event_id: int
    creator_id: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: EventStatus
    estimated_duration: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    participants: Optional[List[ParticipantResponse]] = []
    
    class Config:
        from_attributes = True


class EventWithParticipants(EventResponse):
    participants: List[ParticipantResponse] = []


# ============================================================
# AI Services
# ============================================================

class NLParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class ParsedEvent(BaseModel):
    title: str
    description: Optional[str] = None
    priority: int = Field(default=3, ge=1, le=5)
    estimated_duration: Optional[int] = None  # in minutes
    participant_emails: Optional[List[str]] = []
    time_preferences: Optional[str] = None  # e.g., "morning", "before 5pm"


class NLParseResponse(BaseModel):
    events: List[ParsedEvent]


class AutoScheduleRequest(BaseModel):
    event_ids: List[int]
    range_start: datetime
    range_end: datetime


class AutoScheduleResponse(BaseModel):
    success: bool
    message: str
    scheduled_count: int = 0
    overridden_events: Optional[List[int]] = []


# ============================================================
# API Response Wrappers
# ============================================================

class APIResponse(BaseModel):
    success: bool
    message: str


class PaginatedResponse(BaseModel):
    items: List
    total: int
    page: int = 1
    page_size: int = 10


# ============================================================
# Log
# ============================================================

class LogResponse(BaseModel):
    log_id: int
    time: datetime
    message: str
    user_id: int
    event_id: Optional[int] = None
    action_type: Optional[str] = None
    
    class Config:
        from_attributes = True
