# A0 Poster Script: AI-Assisted Calendar

This document provides a ready-to-use script for a 5-block A0 poster.

---

## 1) A0 Layout Plan (Use This First)

- Poster size: `A0 (841 mm × 1189 mm)`, portrait.
- Margins: `20–25 mm`.
- Suggested reading flow: top to bottom, left to right.

### Block Placement

- **Block 1 (Top-Left):** Background / Motivation
- **Block 2 (Top-Right):** System Overview
- **Block 3 (Center, Wide):** ER Diagram + Data Model
- **Block 4 (Bottom-Left):** SQL Core Logic
- **Block 5 (Bottom-Right):** System Demo

### Optional Extra Components

- Header strip: Title, team, repo QR code.
- Footer strip: Key contributions + links (`/docs`, GitHub, short demo URL).

---

## 2) Header Script

### Title

**AI-Assisted Calendar: From Unscheduled Todos to Conflict-Aware Team Scheduling**

### Subtitle

FastAPI + MySQL Stored Procedures + React + LLM-assisted parsing/scheduling

### One-line Summary

A collaborative calendar that separates task capture from time commitment, then schedules with priority-aware conflict handling and invitation workflows.

---

## 3) Block 1 Script: Background / Motivation

### Block Title

**Why Another Calendar?**

### Main Text (Poster Body)

Team scheduling is often inefficient because people must decide event content and event timing at the same time. This project separates those two actions: users first create unscheduled todos, then commit them to time slots later.  

The design also addresses collaboration friction: invitations, response tracking (accept/decline/maybe), and priority conflicts between overlapping events.  

Compared with a basic calendar, this system supports:

- Two-stage planning: capture first, schedule second.
- Multi-user participation and mailbox-based invitations.
- Priority-driven override rules for conflict resolution.
- Auditability through automatic logging.

### Short Tagline

**Plan first. Commit later. Coordinate safely.**

---

## 4) Block 2 Script: System Overview

### Block Title

**System Architecture and Workflow**

### Architecture Text

The platform uses a three-layer architecture:

- **Frontend (React + TypeScript):** two-column UI with calendar, todo list, natural language modal, auto-schedule modal, and mailbox.
- **Backend (FastAPI):** authenticated REST APIs for events, participants, AI parsing/scheduling, and notifications.
- **Database (MySQL):** core business rules in stored procedures, helper functions, and triggers.

### Data/Control Flow (Use as Diagram Captions)

1. User action in UI (create/schedule/respond).  
2. API request with JWT auth.  
3. Backend validates ownership/state.  
4. Stored procedure executes business logic.  
5. Trigger writes audit log automatically.  
6. Frontend refetches and updates views.

### Callout

**Business integrity is enforced at database level, not only in application code.**

---

## 5) Block 3 Script: ER Diagram + Data Model

### Block Title

**ER Diagram and Core Entities**

### Visual

Place the existing ER image from:

- `assets/erd-diagram.png`

### Explanatory Text

The data model centers on five entities:

- **User:** system identity and account data.
- **Event:** unified table for both todos and scheduled events (`status` distinguishes lifecycle).
- **Participant:** many-to-many mapping between users and events with role and response.
- **Notification:** mailbox records for invitation and action tracking.
- **Log:** immutable audit trail for event and participant operations.

### Key Design Notes

- Unified `Event` model simplifies workflow transitions.
- `Participant` captures both permission context and RSVP state.
- `Notification` decouples invitation UX from event mutation.
- `Log` supports debugging, transparency, and traceability.

---

## 6) Block 4 Script: SQL Core Logic

### Block Title

**SQL as the Rule Engine**

### Main Text

Core scheduling behavior is implemented in stored procedures:

- `sp_schedule_todo`: validates time range, checks creator/participant conflicts, applies priority-based override, and sets event to scheduled.
- `sp_auto_schedule`: batch-schedules unscheduled todos in priority order within a user-selected time window.
- Trigger set (`trg_event_*`, `trg_participant_*`): writes operation logs automatically for create/update/delete and RSVP changes.

### Suggested SQL Snippet (Print Small)

```sql
-- 1) Create an unscheduled todo (creator auto-added as organizer)
CALL sp_create_event(
  1,                                  -- p_creator_id
  'Poster Demo TODO',                 -- p_title
  'Prepare presentation storyboard',  -- p_description
  2,                                  -- p_priority (1 is highest)
  NULL, NULL,                         -- p_start_time, p_end_time
  'unscheduled',                      -- p_status
  60,                                 -- p_estimated_duration
  @event_id                           -- OUT
);
SELECT @event_id AS event_id;

-- 2) Schedule it and read procedure result
CALL sp_schedule_todo(
  @event_id,
  '2026-05-01 10:00:00',
  '2026-05-01 11:00:00',
  @sched_success,
  @sched_message
);
SELECT @sched_success AS success, @sched_message AS message;

-- 3) Verify persisted event state
SELECT event_id, status, start_time, end_time
FROM Event
WHERE event_id = @event_id;
```

### Key Insight

By pushing conflict and priority logic into SQL procedures, API endpoints stay thin and consistency improves across all entry points (manual scheduling, auto-scheduling, invitation acceptance).

---

## 7) Block 5 Script: System Demo

### Block Title

**Live Demo: End-to-End Workflow**

### Demo Storyboard (60–90 seconds)

1. **Natural language input**  
   Enter a short text list of tasks/events; system parses title, duration, priority, participants, and time preference into unscheduled todos.

2. **Manual scheduling**  
   Select todo(s) in right column and click time slots in calendar; show conflict prompt and override behavior.

3. **Auto-scheduling**  
   Select multiple todos, choose `Today / This Week / Custom`, then run auto-schedule; show priority-aware placement.

4. **Mailbox collaboration**  
   Open invitation mailbox, respond with `Accept / Decline / Maybe`; show conflict rejection when equal/higher-priority overlap exists.

5. **Audit evidence**  
   Show that actions are captured in `Log` through SQL triggers.

### Expected Demo Outcome

- Users can move smoothly from task capture to calendar commitment.
- Multi-user responses affect visible scheduling state.
- Priority logic remains consistent across workflows.

---

## 8) Picture Prompt Pack (for Poster Visuals)

Use these prompts with any image generation tool. Keep style consistent across all visuals (same color palette and icon style).

### Prompt A: System Architecture Diagram

Create a clean flat-design architecture diagram for an "AI-Assisted Calendar" web app.
Show three layers: Frontend (React + TypeScript), Backend (FastAPI), Database (MySQL).
Add side AI service (OpenAI) connected to backend.
Include arrows for data flow: UI action -> API -> Stored Procedure -> Trigger Log -> UI refresh.
Use white background, blue/green accent colors, minimal icons, professional academic poster style, high legibility.
Aspect ratio 4:3, high resolution.

### Prompt B: Workflow Infographic

Design a horizontal workflow infographic with five steps:
1) Capture Todo
2) Add Participants
3) Schedule Time
4) Resolve Conflicts by Priority
5) Track Responses + Logs
Use rounded cards, subtle gradients, line icons, and directional arrows.
Style: modern academic poster, clean typography, no clutter, white background.
Aspect ratio 16:9, high resolution.

### Prompt C: Priority Conflict Illustration

Create a conceptual illustration of calendar conflict resolution.
Show two overlapping events with different priorities (Priority 1 and Priority 4).
Visually indicate that higher priority keeps the slot and lower priority is moved back to unscheduled todo list.
Use clear labels and color coding (red for high priority, gray for low priority).
Flat vector style, educational poster graphic, white background.

### Prompt D: Mailbox Collaboration Scene

Generate a UI-style mock illustration of an invitation mailbox for a calendar app.
Show invitation card with sender, event title, time, and buttons: Accept, Maybe, Decline.
Add a small warning badge for conflict with higher priority event.
Style should look like modern SaaS interface, neutral background, crisp typography, no brand logos.
Aspect ratio 3:2.

### Prompt E: AI Natural Language Parsing Graphic

Create an explanatory graphic showing natural language text transformed into structured events.
Left side: free-form text input (bullet list).
Right side: structured fields (title, priority, duration, participants, time preference).
Center: AI parsing icon/brain chip with arrows.
Style: clean data-transformation infographic, academic poster-friendly, high contrast, white background.

### Prompt F: Hero Poster Background Shape

Generate an abstract, subtle background visual for a technical poster header.
Theme: scheduling, time, coordination, and data flow.
Use soft geometric shapes, faint timeline curves, and clock/calendar motifs.
Very light tones, non-distracting, suitable behind title text.
High resolution A0-friendly artwork.

### Prompt G: Product Logo

Design a professional logo for a product named "AI-Assisted Calendar".
Concept: transform unscheduled tasks into organized time blocks; include subtle symbolism of calendar grid + checkmark + smart automation.
Style: clean, modern, minimal, vector-like, suitable for both app icon and poster title lockup.
Color direction: primary deep blue + fresh green accent, with a monochrome version included.
Avoid mascots and photorealism; no busy details.
Deliver on transparent background, centered composition, high resolution.
Also provide one horizontal version (icon + wordmark) and one square icon-only version.

---

## 9) Quick Assembly Checklist

- Use `assets/erd-diagram.png` as the main ER visual (do not redraw from scratch unless needed).
- Keep body text concise; prioritize diagrams and workflow visuals.
- Ensure each block has: problem/idea, mechanism, and takeaway.
- Add one QR code linking to repo and one linking to demo video.
