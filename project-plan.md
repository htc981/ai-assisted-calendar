# AI-Assisted Calendar: Project Plan

---

## Technology Stack (Finalized)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Backend** | Python + FastAPI | Modern, async, auto OpenAPI docs |
| **Database** | MySQL | Production-ready, relational |
| **LLM** | OpenAI API (GPT-4) | Strong instruction following, structured output |
| **Authentication** | JWT | Stateless, simple, works well for local deployment |
| **Real-time** | Refetch on action | Simpler implementation, acceptable for single-user local use |
| **Frontend** | React + TypeScript | Industry standard, strong ecosystem |
| **UI Library** | Tailwind CSS + Headless UI | Flexible, modern, lightweight |
| **Calendar** | FullCalendar React | Feature-rich, supports day/week/month views |
| **Platform** | Desktop-first | Optimized for productivity workflows |
| **Deployment** | Local | Runs on user's machine |
| **CI/CD** | None | Local development only |

---

## Phase 1: Database Layer

### 1.1 Schema Implementation
- [ ] Finalize `schema.sql` with AI feature fields
- [ ] Create database initialization script
- [ ] Add sample data script for testing

### 1.2 Database Access Layer
- [ ] SQLAlchemy ORM setup with MySQL connector
- [ ] Database connection configuration
- [ ] Repository classes:
  - `UserRepository`
  - `EventRepository`
  - `ParticipantRepository`
  - `LogRepository`

### 1.3 Core Queries
- [ ] CRUD operations for all entities
- [ ] Get events by user and date range
- [ ] Get participant availability
- [ ] Transaction support for multi-step operations
- [ ] Automatic logging trigger/helper

**Deliverables:** `models.py`, `database.py`, `repositories/`, `schema.sql`
**Estimated Effort:** 2 days

---

## Phase 2: Backend API

### 2.1 Project Setup
- [ ] FastAPI application structure
- [ ] Environment configuration (`.env` for DB, OpenAI key)
- [ ] CORS middleware for frontend
- [ ] JWT authentication middleware

### 2.2 Authentication APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login (email + name, returns JWT) |
| `/api/auth/register` | POST | Register new user |

### 2.3 User Management APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | GET | List all users (for participant search) |
| `/api/users/me` | GET | Get current user details |

### 2.4 Event Management APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | GET | List events (filter: status, date range, user) |
| `/api/events/:id` | GET | Get event details with participants |
| `/api/events` | POST | Create event/todo |
| `/api/events/:id` | PUT | Update event |
| `/api/events/:id` | DELETE | Delete event (soft delete → status='cancelled') |
| `/api/events/:id/schedule` | POST | Schedule a todo (set start/end time) |

### 2.5 Participant Management APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events/:id/participants` | POST | Add participant(s) |
| `/api/events/:id/participants/:userId` | PUT | Update response status |
| `/api/events/:id/participants/:userId` | DELETE | Remove participant |

### 2.6 AI Service Layer
- [ ] `NaturalLanguageService`
  - `parse_events(text: str) → List[EventDTO]`
  - Prompt engineering for structured JSON output
  - Handle parsing errors gracefully
- [ ] `AutoScheduleService`
  - `schedule_events(event_ids: List[int], date_range: DateRange) → ScheduleResult`
  - Fetch existing events for all participants
  - Extract constraints from descriptions
  - Priority-based greedy scheduling algorithm
  - Override logic (higher priority bumps lower)
  - Return scheduled events + overridden events

### 2.7 AI APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/parse` | POST | Parse natural language → TODOs |
| `/api/ai/schedule` | POST | Auto-schedule selected TODOs |

**Deliverables:** `main.py`, `routers/`, `services/`, `schemas.py`, `auth.py`
**Estimated Effort:** 5 days

---

## Phase 3: Frontend Application

### 3.1 Project Setup
- [ ] Vite + React + TypeScript
- [ ] Tailwind CSS configuration
- [ ] React Router setup
- [ ] API client (Axios with JWT interceptor)

### 3.2 State Management
- [ ] React Query for server state
- [ ] Zustand for UI state (selected TODOs, view mode)
- [ ] Auth context (JWT storage, user info)

### 3.3 Core Layout
- [ ] Two-column layout component
  - Left: Calendar (scheduled events)
  - Right: TODO list (unscheduled)
- [ ] Header with user info, view switcher
- [ ] Responsive container (desktop-optimized)

### 3.4 Unscheduled TODO Column (Right)
- [ ] TODO list with checkboxes (multi-select)
- [ ] TODO item component
  - Title, priority badge, participants preview
  - Checkbox for auto-schedule selection
- [ ] Create TODO form (manual)
- [ ] Natural language input section
  - Textarea for free-form input
  - "Parse & Create" button
  - Loading state during parsing
- [ ] Edit TODO modal
- [ ] Auto-schedule button (disabled until TODOs selected)
  - Time range picker (day/week/custom)
  - Confirmation dialog

### 3.5 Scheduled Events Column (Left)
- [ ] FullCalendar integration
  - Day view (time grid)
  - Week view (time grid)
  - Month view (day grid)
  - View switcher buttons
- [ ] Event rendering with color coding by priority
- [ ] Event click → detail modal
- [ ] Drag-and-drop rescheduling (optional stretch goal)

### 3.6 Event Detail Modal
- [ ] Event info (title, description, time, priority)
- [ ] Participant list with response status
- [ ] Add participant button (search dropdown)
- [ ] Response buttons (for invitees)
- [ ] Edit/Delete buttons (for creator)
- [ ] Cancel/Reschedule options

### 3.7 Notifications & Feedback
- [ ] Toast notifications for actions
- [ ] Loading spinners for async operations
- [ ] Error handling with user-friendly messages
- [ ] Auto-schedule result summary modal
  - Events scheduled
  - Events overridden (with details)

**Deliverables:** `src/`, `components/`, `pages/`, `hooks/`, `services/`
**Estimated Effort:** 7 days

---

## Phase 4: Integration & Testing

### 4.1 Backend-Frontend Integration
- [ ] Connect all API endpoints
- [ ] JWT authentication flow
- [ ] Test complete workflows:
  - Create TODO manually
  - Create TODO via natural language
  - Schedule TODO manually
  - Auto-schedule multiple TODOs
  - Participant invitation & response
  - Override scenario

### 4.2 Testing
- [ ] Backend unit tests (pytest)
  - Repository tests
  - Service tests (AI logic)
  - API endpoint tests
- [ ] Frontend manual testing checklist
- [ ] Bug fixes

### 4.3 Performance
- [ ] Database indexes verified
- [ ] API response times acceptable (<500ms typical)
- [ ] Frontend loading states implemented

**Deliverables:** `tests/`, test scripts, bug fixes
**Estimated Effort:** 3 days

---

## Phase 5: Deployment & Documentation

### 5.1 Local Deployment
- [ ] `requirements.txt` for Python dependencies
- [ ] `package.json` for frontend dependencies
- [ ] `.env.example` template
- [ ] Database setup script
- [ ] Start scripts (`start.sh`, `start.bat`)

### 5.2 Documentation
- [ ] `README.md` with:
  - Project overview
  - Quick start guide
  - Configuration options
  - Usage instructions
- [ ] API documentation (auto-generated by FastAPI at `/docs`)
- [ ] Architecture diagram (update ERD if needed)

### 5.3 Polish
- [ ] UI refinements (spacing, colors, typography)
- [ ] Empty states (no TODOs, no events)
- [ ] Keyboard shortcuts (optional)
- [ ] Error boundary components

**Deliverables:** `README.md`, `.env.example`, start scripts, `/docs`
**Estimated Effort:** 2 days

---

## Project Structure

```
calendar/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── events.py
│   │   │   └── ai.py
│   │   ├── repositories/
│   │   │   ├── user_repo.py
│   │   │   ├── event_repo.py
│   │   │   ├── participant_repo.py
│   │   │   └── log_repo.py
│   │   └── services/
│   │       ├── nl_parser.py
│   │       └── auto_scheduler.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── TodoColumn.tsx
│   │   │   ├── CalendarColumn.tsx
│   │   │   ├── TodoItem.tsx
│   │   │   ├── EventModal.tsx
│   │   │   └── ...
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── schema.sql
├── requirements.md
├── ai-features.md
└── README.md
```

---

## Timeline Summary

| Phase | Description | Days |
|-------|-------------|------|
| 1 | Database Layer | 2 |
| 2 | Backend API | 5 |
| 3 | Frontend Application | 7 |
| 4 | Integration & Testing | 3 |
| 5 | Deployment & Docs | 2 |
| **Total** | | **19 days** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OpenAI API latency | Show loading states, implement timeout handling |
| Complex scheduling conflicts | Start with simple greedy algorithm, document limitations |
| FullCalendar learning curve | Use documented examples, start with basic config |
| MySQL connection issues | Provide clear setup instructions, connection pooling |

---

## Next Steps

1. **Approve this plan** or request changes
2. **Set up OpenAI API key** (required for AI features)
3. **Install MySQL** and create database
4. **Begin Phase 1** (Database Layer)

---

*End of Project Plan*
