# AI-Assisted Calendar: AI Features Specification

---

## 1. Natural Language Event Parsing

### 1.1 Overview

Users can input events in **free-form natural language**. The LLM parses the input and creates structured TODO items in the unscheduled column.

### 1.2 Input Format

- **Free-form text** (paragraph or bullet list)
- Example inputs:
  > "I need to meet with John about the project tomorrow, then finish the quarterly report by Friday. Also, lunch with Sarah sometime this week."

  > "- Team standup every morning
  > - Code review for PR #234
  > - Call the bank before 5pm"

### 1.3 LLM Extraction Fields

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Event name/summary | "Team Meeting" |
| `description` | Additional details, constraints, preferences | "Discuss Q2 roadmap. Prefer morning slot." |
| `priority` | Inferred urgency (1-5) | 2 (high) for deadlines |
| `estimated_duration` | LLM-estimated duration if not specified | 30 min, 1 hour, 2 hours |
| `participants` | Extracted names/emails | ["john@company.com", "sarah@company.com"] |
| `time_preferences` | Soft constraints from context | "morning", "before 5pm", "this week" |
| `deadlines` | Hard constraints (if any) | "by Friday" → end_time constraint |

### 1.4 Processing Flow

```
User Input (Free-form)
         ↓
   LLM Parsing
         ↓
Extract Structured Data
         ↓
Create TODO(s) in Unscheduled Column
         ↓
Time preferences & constraints stored in description
```

### 1.5 Output

- Each parsed item becomes a **TODO** (status = 'unscheduled')
- Time preferences and constraints are preserved in `description` field
- TODOs appear in the **right column** for user review

---

## 2. One-Click Auto Time-Arrangement

### 2.1 Overview

Users can select multiple TODOs from the unscheduled column and trigger **automatic scheduling** within a specified time range. The LLM arranges events optimally and commits them directly to the calendar.

### 2.2 User Workflow

```
1. User selects multiple TODOs from right column
2. User specifies time range (e.g., "today", "this week", "Mar 26-28")
3. User clicks "Auto-Schedule"
4. LLM arranges events and moves them to left column (scheduled)
```

### 2.3 Scheduling Constraints

| Constraint | Behavior |
|------------|----------|
| **Existing calendar** | Avoid conflicts with already-scheduled events |
| **Participant availability** | Check participants' schedules, avoid conflicts |
| **Event priority** | Higher priority events get preferred time slots |
| **Time preferences** | Respect constraints from description (e.g., "morning", "before 5pm") |
| **Duration** | Use LLM-estimated duration if not specified |
| **Time range** | Schedule within user-specified window (day/week/custom) |
| **Buffer time** | Not required (back-to-back events allowed) |

### 2.4 Conflict Resolution

| Scenario | Behavior |
|----------|----------|
| No available slot | LLM finds the "least bad" option |
| Higher priority vs. lower priority | Higher priority event **overrides** lower priority event (lower priority event returns to 'unscheduled') |
| Multiple conflicts | LLM optimizes globally for best overall arrangement |

### 2.5 Auto-Commit Behavior

- **No review step** — Events are automatically committed to the database
- All changes are **logged** in the `Log` table
- Participants are **notified** of new invitations
- Overridden events are set back to `status = 'unscheduled'`

### 2.6 LLM Scheduling Logic

```
Input: List of TODOs + Time Range
         ↓
Fetch existing events for all involved users
         ↓
Extract constraints from each TODO description
         ↓
Sort TODOs by priority (highest first)
         ↓
For each TODO:
  - Find available slots respecting constraints
  - If conflict with lower priority event → override
  - Assign start_time, end_time
  - Set status = 'scheduled'
         ↓
Commit all changes to database
         ↓
Log all actions
```

---

## 3. Calendar View

### 3.1 Scrollable Multi-Level View

| View | Description |
|------|-------------|
| **Day View** | Hour-by-hour schedule for a single day |
| **Week View** | 7-day grid with time slots |
| **Month View** | Monthly overview with event summaries |

### 3.2 Features

- **Seamless switching** between day/week/month views
- **Scroll navigation** to browse past/future dates
- **Two-column layout** maintained across all views:
  - Left: Scheduled events (calendar grid)
  - Right: Unscheduled TODOs (list)
- **Visual indicators** for:
  - Event priority (color coding)
  - Participant response status
  - Override warnings (if applicable)

---

## 4. Database Changes

### 4.1 New Fields (Optional)

```sql
ALTER TABLE Event ADD COLUMN estimated_duration INTEGER; -- in minutes
ALTER TABLE Event ADD COLUMN time_preferences TEXT; -- JSON string for LLM constraints
```

### 4.2 Logging Requirements

All AI actions must be logged:

| Action | Log Message Example |
|--------|---------------------|
| TODO created from NL | "Created TODO 'Team Meeting' from natural language input" |
| Auto-schedule triggered | "Auto-scheduled 5 events for date range 2026-03-26 to 2026-03-28" |
| Event overridden | "Event 'Code Review' overridden by higher priority event 'Client Call'" |

---

## 5. Example Scenarios

### Scenario 1: Natural Language Input

**User Input:**
> "I need to have a 1-hour meeting with John and Sarah about the budget review, preferably tomorrow morning. Also, I should finish the presentation slides by end of week."

**LLM Output (2 TODOs):**

| TODO 1 | TODO 2 |
|--------|--------|
| Title: "Budget Review Meeting" | Title: "Finish Presentation Slides" |
| Description: "With John and Sarah. Prefer tomorrow morning." | Description: "Deadline: end of week" |
| Priority: 3 | Priority: 4 |
| Estimated Duration: 60 min | Estimated Duration: 120 min |
| Participants: [John, Sarah] | Participants: [] |
| Time Preferences: "tomorrow morning" | Time Preferences: "before Friday EOD" |

---

### Scenario 2: Auto-Schedule with Override

**User Action:**
- Selects 5 TODOs from right column
- Sets time range: "Today (9 AM - 6 PM)"
- Clicks "Auto-Schedule"

**LLM Arrangement:**

| Time | Event | Priority |
|------|-------|----------|
| 09:00-10:00 | Client Call (override) | 1 |
| 10:00-11:00 | Team Standup | 2 |
| 11:00-12:00 | Code Review | 3 |
| 13:00-14:00 | Budget Meeting | 2 |
| 14:00-16:00 | Deep Work Session | 4 |

**Override Example:**
- "Deep Work Session" was originally at 09:00
- Higher priority "Client Call" (priority 1) overrides it
- "Deep Work Session" moved to 14:00-16:00
- Log entry created for the override

---

## 6. Technical Considerations

| Consideration | Recommendation |
|---------------|----------------|
| LLM Model | Use a model with strong instruction-following and structured output capabilities |
| Response Format | JSON schema for consistent parsing |
| Latency | Show loading indicator during LLM processing (< 5 seconds target) |
| Error Handling | Graceful fallback if LLM fails (show raw input, allow manual entry) |
| Rate Limiting | Implement request throttling for LLM API calls |

---

## 7. Out of Scope (Phase 1)

- Recurring event suggestions
- Learning from user preferences over time
- Email integration for participant invitations
- Mobile push notifications
- Voice input support

---

*End of AI Features Specification*
