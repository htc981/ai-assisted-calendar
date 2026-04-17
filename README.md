# AI-Assisted Calendar

A collaborative calendar application with AI-powered scheduling assistance. Features a two-column interface separating unscheduled todos from scheduled events, natural language event creation, and intelligent auto-scheduling with priority-based conflict resolution.

## ✨ Features

### Core Functionality

#### Two-Column Workspace
- **Left Column - Scheduled Events**: Calendar view showing events with confirmed times in day/week/month views
- **Right Column - Unscheduled Todos**: Actionable task list for items awaiting time assignment
- Toggle between Month, Week, and Day views for flexible planning

#### Event & Todo Management
- **Create Todos**: Add tasks with title, description, priority (1-5), and estimated duration
- **Edit Events**: Modify title, description, priority, time, and duration
- **Delete Events**: Remove events permanently (creator only)
- **Cancel Events**: Soft-delete events to mark as cancelled
- **Unschedule Events**: Move scheduled events back to unscheduled todos

#### Priority System
- **5-Level Priority Scale**:
  - Priority 1: Urgent (critical deadlines, emergency meetings)
  - Priority 2: High (important meetings, time-sensitive tasks)
  - Priority 3: Normal (regular tasks, standard meetings)
  - Priority 4: Low (non-urgent tasks, nice-to-have meetings)
  - Priority 5: Optional (can be deferred)
- Higher priority events can override lower priority events during scheduling
- Visual color coding for quick priority identification

#### Multi-User Collaboration
- **Add Participants**: Invite team members to events with roles (organizer/required/optional)
- **Response Tracking**: Participants can respond with Accept/Decline/Maybe
- **User Search**: Find participants by name or email
- **Creator Permissions**: Only event creators can edit/delete events
- **Participant Visibility**: Users see events they're invited to (when accepted)

### 🤖 AI Features

#### Natural Language Input
- Type free-form text to create multiple events at once
- AI extracts:
  - Event titles and descriptions
  - Priority levels (inferred from context)
  - Estimated durations (e.g., "quick call" → 15-30 min)
  - Participant emails from text
  - Time preferences (e.g., "tomorrow at 2pm", "before 5pm")
- Support for bullet lists and structured input
- Parent time context recognition (e.g., "My schedule for tomorrow:" applies to all listed items)

**Example Input:**
```
Team meeting tomorrow at 2pm for 1 hour with John (john@example.com)
Review PR #234 (high priority)
Lunch with Sarah on Friday
Finish quarterly report by end of week
```

#### Auto-Scheduling
- Select multiple todos and let AI find optimal time slots
- **Scheduling Constraints**:
  - Respects existing calendar commitments
  - Checks participant availability
  - Honors time preferences from descriptions
  - Uses estimated durations for proper time allocation
- **Time Range Options**: Today, This Week, or Custom Range
- **Priority-Based Scheduling**: Higher priority events get preferred slots
- **Automatic Conflict Resolution**: Lower priority events return to unscheduled when overridden

### 📬 Mailbox & Notifications

- **Inbox View**: See all pending event invitations
- **Badge Indicators**: Red badge for pending invitations, yellow for Maybe responses
- **Quick Actions**: Accept/Decline/Maybe directly from mailbox
- **Conflict Detection**: Accepting invitations with conflicts triggers warnings
- **Priority Protection**: Can't accept if conflicts with equal/higher priority events

### 📊 Audit Trail

- Complete logging of all operations in the `Log` table
- Tracks: event creation, updates, deletions, participant changes, responses
- Includes timestamps, user IDs, and action types

---

## 🏗️ Architecture

| Layer | Technology |
|-------|------------|
| Backend | Python 3.10+ with FastAPI |
| Database | MySQL 8.0+ with stored procedures & triggers |
| Frontend | React 18 + TypeScript + Vite |
| UI Styling | Tailwind CSS + Headless UI |
| Calendar Component | FullCalendar React |
| State Management | Zustand (UI state) + React Query (server state) |
| AI/LLM | OpenAI API (gpt-5.4-mini or compatible) |
| Authentication | JWT tokens with bcrypt password hashing |

---

## 📁 Project Structure

```
calendar/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── config.py            # Pydantic settings configuration
│   │   ├── database.py          # SQLAlchemy connection & session management
│   │   ├── auth.py              # JWT authentication utilities
│   │   ├── schemas.py           # Pydantic models for request/response validation
│   │   ├── routers/             # API endpoint handlers
│   │   │   ├── auth.py          # /api/auth/login, /register
│   │   │   ├── users.py         # /api/users endpoints
│   │   │   ├── events.py        # /api/events CRUD + scheduling
│   │   │   ├── participants.py  # /api/events/:id/participants
│   │   │   ├── ai.py            # /api/ai/parse, /schedule, /create-from-nl
│   │   │   └── notifications.py # /api/notifications (mailbox)
│   │   └── services/            # Business logic layer
│   │       ├── nl_parser.py     # Natural language parsing with OpenAI
│   │       └── scheduler.py     # Auto-scheduling algorithm (LLM + deterministic)
│   ├── tests/
│   │   ├── conftest.py          # Pytest fixtures
│   │   ├── test_api.py          # API endpoint tests
│   │   ├── test_db.py           # Database tests
│   │   └── test_ai.py           # AI service tests
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment template
│   └── start.sh                 # Backend startup script
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Root component with routing
│   │   ├── main.tsx             # Entry point
│   │   ├── index.css            # Global styles + Tailwind
│   │   ├── components/          # Reusable UI components
│   │   │   ├── TodoColumn.tsx   # Right column (unscheduled todos)
│   │   │   ├── TodoItem.tsx     # Individual todo item with checkbox
│   │   │   ├── EventModal.tsx   # Event detail/edit modal
│   │   │   ├── NLInputModal.tsx # Natural language input dialog
│   │   │   ├── AutoScheduleModal.tsx # Auto-schedule dialog
│   │   │   ├── MailboxModal.tsx # Invitation mailbox
│   │   │   ├── ConfirmModal.tsx # Confirmation dialogs
│   │   │   └── TodoItem.tsx     # Todo item component
│   │   ├── pages/               # Page-level components
│   │   │   ├── Login.tsx        # Login page
│   │   │   └── Calendar.tsx     # Main calendar page
│   │   ├── hooks/               # React Query hooks for API calls
│   │   │   ├── useEvents.ts     # Event CRUD + scheduling hooks
│   │   │   ├── useAuth.ts       # User/participant hooks
│   │   │   └── useNotifications.ts # Mailbox hooks
│   │   ├── services/            # Axios API client
│   │   │   └── api.ts           # API wrapper with interceptors
│   │   ├── store/               # Zustand stores
│   │   │   ├── authStore.ts     # Authentication state
│   │   │   └── uiStore.ts       # UI state (selected todos, modals)
│   │   └── types/               # TypeScript type definitions
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── scripts/
│   ├── init_db.sh               # Database initialization (requires root)
│   ├── test_db.sh               # Run database test cases
│   ├── schema.sql               # Full database schema (1090 lines)
│   ├── seed_data.sql            # Sample data for testing
│   └── test_db_cases.sql        # SQL-level test cases
│
├── assets/
│   ├── erd-diagram.png          # Entity relationship diagram
│   └── erdplus.png              # ERD from ERDPlus
│
├── README.md                    # This file
├── requirements.md              # Product requirements (PRD)
├── ai-features.md               # AI features specification
├── project-plan.md              # Development plan & timeline
└── TEST_CASES.md                # Comprehensive test cases
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8.0+ (with root access for initial setup)
- OpenAI API key (for AI features)

### 1. Database Setup

**Note:** This step requires MySQL root access to create stored functions and procedures.

```bash
# Option A: Run initialization script (recommended)
chmod +x scripts/init_db.sh
export MYSQL_ROOT_PASSWORD=your_root_password
./scripts/init_db.sh

# Option B: Manual setup
mysql -u root -p -e "CREATE DATABASE calendar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'calendar_user'@'localhost' IDENTIFIED BY 'your_password';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON calendar.* TO 'calendar_user'@'%';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON calendar.* TO 'calendar_user'@'localhost';"
mysql -u root -p -e "GRANT SYSTEM_USER ON *.* TO 'calendar_user'@'%';"
mysql -u root -p -e "GRANT SYSTEM_USER ON *.* TO 'calendar_user'@'localhost';"
mysql -u root -p -e "SET GLOBAL log_bin_trust_function_creators = 1;"
mysql -u root -p calendar < scripts/schema.sql

# Optional: Load sample data
mysql -u calendar_user -p calendar < scripts/seed_data.sql
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment (if not exists)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings:
# - DB_PASSWORD
# - JWT_SECRET_KEY
# - OPENAI_API_KEY
# - OPENAI_MODEL (default: gpt-5.4-mini)

# Start development server
./start.sh
# Or manually:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API documentation available at: http://localhost:8000/docs

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Application URL: http://localhost:5173

---

## 📖 Usage Guide

### Authentication

1. **Register**: Create account with name and email
2. **Login**: Enter email (and optionally update name)
3. **JWT Token**: Stored in localStorage, auto-included in API requests
4. **Session Expiry**: Automatic logout with toast notification when token expires

### Creating Events

#### Manual Creation
1. Click **"+ Add Todo"** in the right column
2. Enter:
   - Title (required)
   - Description (optional)
   - Priority (1-5, default: 3)
   - Estimated duration (15-480 minutes, default: 30)
3. Click **"Create"** → Todo appears in unscheduled list

#### Natural Language Creation
1. Click **"✨ Natural Language"** button in header
2. Type your events in plain English:
   ```
   Team meeting tomorrow at 2pm for 1 hour with John (john@example.com)
   Review PR #234 (high priority, 45 minutes)
   Lunch with Sarah on Friday
   Finish quarterly report by end of week (priority 2)
   ```
3. Press **Ctrl+Enter** or click **"Create Events"**
4. AI parses and creates multiple todos with extracted details

### Scheduling Events

#### Manual Scheduling
1. **Select todos** from right column (click to toggle selection)
2. **Click a time slot** on the calendar
3. **Confirm** in the dialog
4. Todos move to scheduled column (left)

**Conflict Handling:**
- If time slot has conflicts, shows warning with conflicting event names
- Confirming will override lower priority events
- Higher/equal priority events block scheduling

#### Click-to-Schedule Multiple
1. Select multiple todos (checkboxes)
2. Click a time slot
3. All selected todos schedule **sequentially** (back-to-back)
4. Each uses its estimated duration

#### Auto-Scheduling
1. Select multiple todos from right column
2. Click **"🤖 Auto-Schedule"** button
3. Choose time range:
   - **Today**: 9 AM - 6 PM
   - **This Week**: 7 days from now, 9 AM - 6 PM
   - **Custom**: Pick start/end dates
4. Click **"Auto-Schedule"**
5. AI finds optimal slots considering:
   - Existing commitments
   - Participant availability
   - Time preferences
   - Priority levels

### Managing Participants

#### Adding Participants
1. Open event by clicking on it
2. In event modal, click **"Edit"**
3. Select user from dropdown
4. Click **"Add"** → participant receives invitation notification

#### Responding to Invitations
1. Click **"Inbox"** button in header (shows badge count)
2. View pending invitations in mailbox modal
3. Click **Accept/Decline/Maybe**:
   - **Accept**: Adds event to your calendar (checks for conflicts)
   - **Decline**: Marks as declined, event stays in calendar
   - **Maybe**: Tentative response, can change later

#### Conflict on Accept
- If accepting creates conflict with higher/equal priority event:
  - Acceptance is **rejected**
  - Response auto-set to **Declined**
  - Error message explains the conflict

#### Removing Participants
- **Creator**: Can remove any participant
- **Participant**: Can remove themselves
- Removal deletes invitation from mailbox

### Event Lifecycle

```
Create Todo (unscheduled)
    ↓
Add Participants (optional)
    ↓
Schedule Event (set time → scheduled)
    ↓
Participants Respond (accept/decline/maybe)
    ↓
[Optional] Cancel or Unschedule
    ↓
[Optional] Delete (permanent)
```

---

## 🔌 API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user (name, email) |
| `/api/auth/login` | POST | Login (email, optional name update) → JWT token |

### Users

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/me` | GET | Get current user details |
| `/api/users` | GET | List all users (for participant search) |
| `/api/users/:id` | GET | Get user by ID |

### Events

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | GET | List events (filter by status, date range) |
| `/api/events/:id` | GET | Get event details with participants |
| `/api/events` | POST | Create event/todo |
| `/api/events/:id` | PUT | Update event (creator only) |
| `/api/events/:id/schedule` | POST | Schedule a todo (set start/end time) |
| `/api/events/:id/cancel` | POST | Cancel event (soft delete) |
| `/api/events/:id` | DELETE | Delete event (hard delete, creator only) |

### Participants

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events/:id/participants` | GET | List participants |
| `/api/events/:id/participants` | POST | Add participant |
| `/api/events/:id/participants/:uid/response` | PUT | Update own response |
| `/api/events/:id/participants/:uid` | DELETE | Remove participant |

### AI Services

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/parse` | POST | Parse natural language → structured events |
| `/api/ai/schedule` | POST | Auto-schedule multiple todos |
| `/api/ai/create-from-nl` | POST | Parse NL and create events directly |

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | Get pending invitations |
| `/api/notifications/:id/action` | PUT | Handle invitation (accept/decline/maybe) |

---

## 🗄️ Database Schema

### Tables

#### User
```sql
User (
  user_id INTEGER PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  created_at DATETIME
)
```

#### Event (Unified for Todos & Scheduled Events)
```sql
Event (
  event_id INTEGER PRIMARY KEY,
  creator_id INTEGER FOREIGN KEY → User,
  title VARCHAR(200),
  description TEXT,
  priority INTEGER CHECK (1-5),
  start_time DATETIME,
  end_time DATETIME,
  status VARCHAR(20) CHECK ('unscheduled', 'scheduled', 'cancelled'),
  estimated_duration INTEGER,  -- minutes
  created_at DATETIME,
  updated_at DATETIME
)
```

#### Participant (Many-to-Many)
```sql
Participant (
  user_id INTEGER FOREIGN KEY → User,
  event_id INTEGER FOREIGN KEY → Event,
  role VARCHAR(20) CHECK ('organizer', 'required', 'optional'),
  response VARCHAR(20) CHECK ('pending', 'accepted', 'declined', 'tentative'),
  created_at DATETIME,
  PRIMARY KEY (user_id, event_id)
)
```

#### Notification (Internal Mailbox)
```sql
Notification (
  notification_id INTEGER PRIMARY KEY,
  user_id INTEGER FOREIGN KEY → User,  -- recipient
  from_user_id INTEGER FOREIGN KEY → User,  -- sender
  event_id INTEGER FOREIGN KEY → Event,
  notification_type VARCHAR(50),  -- 'invitation', 'update', 'cancellation'
  message TEXT,
  is_read BOOLEAN,
  action_taken VARCHAR(20),  -- 'accepted', 'declined', 'tentative'
  created_at DATETIME
)
```

#### Log (Audit Trail)
```sql
Log (
  log_id INTEGER PRIMARY KEY,
  time DATETIME,
  message TEXT,
  user_id INTEGER FOREIGN KEY → User,
  event_id INTEGER FOREIGN KEY → Event,
  action_type VARCHAR(50)  -- 'EVENT_CREATE', 'PARTICIPANT_ADD', etc.
)
```

### Key Design Decisions

- **Unified Event/Todo Table**: Both use `Event` table; `status` distinguishes them
- **Database-Level Business Logic**: Stored procedures enforce data integrity
- **Automatic Logging**: Triggers log all changes automatically
- **Soft Deletes**: Cancelled events set `status = 'cancelled'`
- **Priority Override**: Lower number = higher priority (1 can override 5)

---

## ⚙️ Configuration

### Environment Variables (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_NAME` | Database name | calendar |
| `DB_USER` | Database user | calendar_user |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET_KEY` | JWT signing secret | - |
| `JWT_ALGORITHM` | JWT algorithm | HS256 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | 360 (6 hours) |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_BASE_URL` | OpenAI API base URL | https://api.openai.com/v1 |
| `OPENAI_MODEL` | OpenAI model | gpt-5.4-mini |
| `CORS_ORIGINS` | Allowed origins | http://localhost:5173,http://localhost:3000 |
| `DEBUG` | Debug mode | True |

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

### Database Tests
```bash
chmod +x scripts/test_db.sh
./scripts/test_db.sh
```

### Frontend Tests
```bash
cd frontend
npm test
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Database connection failed** | Verify MySQL running: `mysqladmin -u root -p ping` |
| **Stored procedure errors** | Ensure `log_bin_trust_function_creators = 1` |
| **OpenAI API errors** | Check API key validity at platform.openai.com |
| **Frontend build fails** | Clear node_modules: `rm -rf node_modules && npm install` |
| **CORS errors** | Verify `CORS_ORIGINS` in backend `.env` includes frontend URL |
| **JWT token expired** | Frontend dispatches `auth-expired` event; user redirected to login |
| **Auto-schedule fails** | Try wider date range or fewer events |
| **Natural language parsing fails** | Check OpenAI quota; try simpler input |

---

## 📝 Development Conventions

### Backend (Python/FastAPI)
- Type hints for all function parameters and return values
- Pydantic models in `schemas.py` with `from_attributes`
- Dependency injection with `get_db()` in routers
- HTTPException with appropriate status codes
- Docstrings for all routers and service functions

### Frontend (React/TypeScript)
- Functional components with TypeScript interfaces
- Zustand for UI state, React Query for server state
- Axios interceptors for JWT token injection
- Tailwind CSS utility classes
- PascalCase components, camelCase variables

### Git/Commits
- Feature branches: `feature/<feature-name>`
- Bug fix branches: `fix/<bug-description>`
- Conventional Commits: `feat:`, `fix:`, `chore:`, etc.

---

## 📚 Documentation

- [Product Requirements (PRD)](requirements.md)
- [AI Features Specification](ai-features.md)
- [Project Plan](project-plan.md)
- [Test Cases](TEST_CASES.md)
- [ERD Diagram](assets/erd-diagram.png)

---

## 🛡️ Security

- JWT authentication with bcrypt password hashing
- Token expiration and automatic logout
- User-level authorization (creator-only edits/deletes)
- Participant access control
- SQL injection prevention via parameterized queries
- CORS configuration for allowed origins only

---

## 📄 License

MIT

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Run tests
5. Push to branch (`git push origin feature/amazing-feature`)
6. Submit a pull request

---

**Built with** ❤️ **using FastAPI, React, and MySQL**
