# AI-Assisted Calendar

A collaborative calendar application with AI-powered scheduling assistance. Features a two-column interface separating unscheduled todos from scheduled events, natural language event creation, and intelligent auto-scheduling.

## Features

### Core Functionality
- **Two-Column Interface**: Separate views for scheduled events (left) and unscheduled todos (right)
- **Natural Language Input**: Create events by typing in plain English
- **Auto-Scheduling**: One-click intelligent scheduling for multiple todos
- **Multi-User Support**: Add participants to events and track responses
- **Priority-Based Scheduling**: Higher priority events get preferred time slots
- **Conflict Resolution**: Automatic override of lower priority events

### AI Features
- Parse free-form text into structured events
- Extract priority, duration, participants, and time preferences
- Intelligent time slot selection considering existing commitments
- Priority-based conflict resolution

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python + FastAPI |
| Database | MySQL 8.0+ |
| Frontend | React + TypeScript |
| UI | Tailwind CSS + Headless UI |
| Calendar | FullCalendar |
| AI | OpenAI API |
| State | Zustand + React Query |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL 8.0+
- OpenAI API key

### 1. Database Setup

**Note:** This step requires MySQL root access to create stored functions and procedures.

```bash
# Run the database initialization script
chmod +x scripts/init_db.sh

# If you have MySQL root password:
export MYSQL_ROOT_PASSWORD=your_root_password
./scripts/init_db.sh

# Or run manually without the script:
mysql -u root -p -e "CREATE DATABASE calendar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'calendar_user'@'localhost' IDENTIFIED BY 'your_password';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON calendar.* TO 'calendar_user'@'%';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON calendar.* TO 'calendar_user'@'localhost';"
mysql -u root -p -e "GRANT SYSTEM_USER ON *.* TO 'calendar_user'@'%';"
mysql -u root -p -e "GRANT SYSTEM_USER ON *.* TO 'calendar_user'@'localhost';"
mysql -u root -p -e "SET GLOBAL log_bin_trust_function_creators = 1;"
mysql -u root -p calendar < scripts/schema.sql
```

# (Optional) Import sample data
mysql -u calendar_user -p calendar < scripts/seed_data.sql
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings:
# - DB_PASSWORD
# - JWT_SECRET_KEY
# - OPENAI_API_KEY

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API documentation will be available at: http://localhost:8000/docs

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at: http://localhost:5173

## Usage

### Creating Events

#### Manual Creation
1. Click "+ Add Todo" in the right column
2. Enter title, description, and priority
3. Click "Create"

#### Natural Language Creation
1. Click "✨ Natural Language" button in header
2. Type your events in plain English:
   ```
   Team meeting tomorrow at 2pm for 1 hour
   Review PR #234 with John (john@example.com)
   Lunch with Sarah on Friday (high priority)
   ```
3. Click "Create Events"

### Scheduling Events

#### Manual Scheduling
1. Select todos from the right column (click to toggle selection)
2. Click on a time slot in the calendar
3. Confirm the scheduling

#### Auto-Scheduling
1. Select multiple todos from the right column
2. Click "🤖 Auto-Schedule" button
3. Choose time range (Today/Week/Custom)
4. Click "Auto-Schedule"

### Managing Participants
1. Open an event by clicking on it
2. In the event modal, use the dropdown to select a user
3. Click "Add" to invite them
4. Participants can respond with Accept/Decline/Maybe

## Project Structure

```
calendar/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application
│   │   ├── config.py         # Configuration
│   │   ├── database.py       # Database connection
│   │   ├── auth.py           # JWT authentication
│   │   ├── schemas.py        # Pydantic models
│   │   ├── routers/          # API endpoints
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── events.py
│   │   │   ├── participants.py
│   │   │   └── ai.py
│   │   └── services/         # Business logic
│   │       ├── nl_parser.py  # Natural language parsing
│   │       └── scheduler.py  # Auto-scheduling
│   ├── tests/
│   │   ├── conftest.py       # Pytest fixtures
│   │   ├── test_db.py        # Database tests
│   │   ├── test_api.py       # API tests
│   │   └── test_ai.py        # AI service tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # React Query hooks
│   │   ├── services/         # API client
│   │   ├── store/            # Zustand stores
│   │   └── types/            # TypeScript types
│   └── package.json
├── scripts/
│   ├── init_db.sh            # Database setup
│   ├── test_db.sh            # Run DB tests
│   ├── schema.sql            # Database schema
│   ├── test_db_cases.sql     # SQL test cases
│   └── seed_data.sql         # Sample data
├── requirements.md           # Product requirements
├── ai-features.md            # AI features specification
└── README.md                 # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Users
- `GET /api/users/me` - Get current user
- `GET /api/users` - List all users

### Events
- `GET /api/events` - List events
- `GET /api/events/:id` - Get event details
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `POST /api/events/:id/schedule` - Schedule a todo
- `POST /api/events/:id/cancel` - Cancel event
- `DELETE /api/events/:id` - Delete event

### Participants
- `GET /api/events/:id/participants` - List participants
- `POST /api/events/:id/participants` - Add participant
- `PUT /api/events/:id/participants/:uid/response` - Update response
- `DELETE /api/events/:id/participants/:uid` - Remove participant

### AI Services
- `POST /api/ai/parse` - Parse natural language
- `POST /api/ai/schedule` - Auto-schedule events
- `POST /api/ai/create-from-nl` - Create events from NL

## Testing

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

## Database Schema

The application uses four main tables:

- **User**: User accounts
- **Event**: Events and todos (both use the same table)
- **Participant**: Many-to-many relationship between users and events
- **Log**: Audit trail for all operations

All business logic is implemented at the database level using stored procedures and triggers for data integrity.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_NAME` | Database name | calendar |
| `DB_USER` | Database user | calendar_user |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET_KEY` | JWT signing key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_MODEL` | OpenAI model | gpt-4o-mini |

## Troubleshooting

### Database Connection Failed
- Verify MySQL is running: `mysqladmin -u root -p ping`
- Check credentials in `.env`
- Ensure database was created: `mysql -u root -p -e "SHOW DATABASES;"`

### OpenAI API Errors
- Verify API key is valid
- Check API quota at https://platform.openai.com/account/usage
- Ensure network connectivity

### Frontend Build Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (requires 18+)

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request
