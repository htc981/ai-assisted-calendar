# AI-Assisted Calendar - Test Cases

**Version:** 2.0  
**Last Updated:** March 28, 2026

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Event Management](#2-event-management)
3. [Scheduling](#3-scheduling)
4. [Participant Management](#4-participant-management)
5. [Natural Language Processing](#5-natural-language-processing)
6. [Auto-Scheduling](#6-auto-scheduling)
7. [UI/UX](#7-uiux)
8. [Priority System](#8-priority-system)
9. [Error Handling](#9-error-handling)
10. [Corner Cases](#10-corner-cases)

---

## 1. Authentication

### 1.1 Login

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| AUTH-001 | Successful login | 1. Enter valid email<br>2. Enter name (optional)<br>3. Click "Sign In" | - User logged in successfully<br>- Redirected to calendar page<br>- Welcome message displayed |
| AUTH-002 | Login with unregistered email | 1. Enter unregistered email<br>2. Click "Sign In" | - Error: "Account not found. Please register first." |
| AUTH-003 | Login with empty email | 1. Leave email empty<br>2. Click "Sign In" | - Browser validation prevents submission |
| AUTH-004 | Session expiration | 1. Login<br>2. Wait for token to expire (7 days)<br>3. Perform any action | - Error: "Session expired. Please login again."<br>- Redirected to login page |

### 1.2 Registration

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| AUTH-005 | Successful registration | 1. Click "Register"<br>2. Enter name<br>3. Enter unique email<br>4. Click "Create Account" | - Account created<br>- Success message displayed<br>- Returned to login form |
| AUTH-006 | Register with existing email | 1. Enter existing email<br>2. Click "Create Account" | - Error: "This email is already registered. Please login instead." |
| AUTH-007 | Register without name | 1. Leave name empty<br>2. Click "Create Account" | - Error: "Please enter your name" |

---

## 2. Event Management

### 2.1 Create Event (Manual)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| EVT-001 | Create unscheduled todo | 1. Click "+ Add Todo"<br>2. Enter title<br>3. Enter description (optional)<br>4. Select priority<br>5. Click "Create" | - Todo appears in right column<br>- Status is "unscheduled"<br>- Success message displayed |
| EVT-002 | Create todo without title | 1. Click "+ Add Todo"<br>2. Leave title empty<br>3. Click "Create" | - Todo not created<br>- Form remains open |
| EVT-003 | Create todo with all fields | 1. Click "+ Add Todo"<br>2. Enter title, description<br>3. Select priority 1 (Urgent)<br>4. Click "Create" | - Todo created with all details<br>- Priority badge shows "Urgent" (red) |

### 2.2 Edit Event

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| EVT-004 | Edit event title | 1. Click event to open modal<br>2. Click "Edit"<br>3. Change title<br>4. Click "Save" | - Title updated<br>- Success: "Event updated successfully" |
| EVT-005 | Edit event time | 1. Open scheduled event<br>2. Click "Edit"<br>3. Change start/end time<br>4. Click "Save" | - Time updated<br>- Event remains in calendar |
| EVT-006 | Edit with invalid time range | 1. Open event modal<br>2. Click "Edit"<br>3. Set end time before start time<br>4. Click "Save" | - Error: "End time must be after start time"<br>- Changes not saved |
| EVT-007 | Edit without permission | 1. Login as User A<br>2. Create event<br>3. Login as User B<br>4. Try to edit User A's event | - Event modal opens in view-only mode<br>- No edit buttons visible |
| EVT-008 | Edit event title to empty | 1. Open event modal<br>2. Click "Edit"<br>3. Clear title<br>4. Click "Save" | - Error: "Title is required"<br>- Changes not saved |

### 2.3 Delete Event

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| EVT-009 | Delete own event | 1. Open own event modal<br>2. Click "Delete"<br>3. Confirm in modal | - Event deleted<br>- Success: "Event deleted successfully"<br>- Modal closes |
| EVT-010 | Cancel delete | 1. Click "Delete"<br>2. Click "Cancel" in modal | - Delete cancelled<br>- Event remains<br>- Modal stays open |
| EVT-011 | Delete already deleted event | 1. Delete event<br>2. Try to delete again (via API) | - Error: "Event not found - it may have been already deleted" |

### 2.4 Cancel/Unschedule Event

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| EVT-012 | Cancel scheduled event | 1. Open scheduled event<br>2. Click "Cancel"<br>3. Confirm | - Event status = "cancelled"<br>- Removed from calendar view |
| EVT-013 | Unschedule event | 1. Open scheduled event<br>2. Click "Unschedule"<br>3. Confirm | - Event moved to unscheduled column<br>- Start/end time cleared<br>- Success: "Event moved to unscheduled" |

---

## 3. Scheduling

### 3.1 Manual Scheduling

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| SCH-001 | Schedule single todo | 1. Select one todo<br>2. Click empty time slot<br>3. Confirm in modal | - Todo scheduled at selected time<br>- Moved from right to left column |
| SCH-002 | Schedule multiple todos | 1. Select 3 todos<br>2. Click time slot<br>3. Confirm | - All 3 todos scheduled at same time<br>- All removed from right column |
| SCH-003 | Schedule with conflict | 1. Select todo<br>2. Click occupied time slot<br>3. Confirm in conflict modal | - If higher priority: conflict event unscheduled<br>- If lower priority: Error with conflict details |
| SCH-004 | Schedule without selection | 1. Select no todos<br>2. Click time slot | - Info message: "Select todos from the right panel first..." |
| SCH-005 | Schedule with 30-min minimum | 1. Select todo with 15-min duration<br>2. Schedule at 10:00 | - Event scheduled 10:00-10:30 (30 min minimum enforced) |

### 3.2 Schedule via Event Click

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| SCH-006 | Click event with todos selected | 1. Select todos<br>2. Click existing calendar event<br>3. Confirm override | - Todos scheduled at clicked event's time<br>- Clicked event unscheduled |
| SCH-007 | Click event without selection | 1. Select no todos<br>2. Click calendar event | - Event details modal opens<br>- No scheduling action |

---

## 4. Participant Management

### 4.1 Add Participants

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PAR-001 | Add participant | 1. Open own event<br>2. Click "Edit"<br>3. Select user from dropdown<br>4. Click "Add" | - Participant added<br>- Success: "Participant added successfully" |
| PAR-002 | Add duplicate participant | 1. Add user as participant<br>2. Try to add same user again | - Error: "This user is already a participant" |
| PAR-003 | Non-creator adds participant | 1. Open other's event<br>2. Try to add participant | - Add button not visible<br>- View-only mode |

### 4.2 Remove Participants

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PAR-004 | Creator removes participant | 1. Open own event<br>2. Click "Edit"<br>3. Click "Remove" next to participant | - Participant removed<br>- Success: "Participant removed successfully" |
| PAR-005 | Participant removes self | 1. Open event as participant<br>2. Try to remove self | - Remove button not visible for self |

### 4.3 Response Management

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PAR-006 | Accept invitation | 1. Open event as participant<br>2. Click "Accept" | - Response updated to "accepted"<br>- Success: "Response updated to accepted" |
| PAR-007 | Decline invitation | 1. Open event as participant<br>2. Click "Decline" | - Response updated to "declined" |
| PAR-008 | Tentative response | 1. Open event as participant<br>2. Click "Maybe" | - Response updated to "tentative" |
| PAR-009 | Non-participant responds | 1. Open event as non-participant<br>2. Try to respond | - Response buttons not visible |

---

## 5. Natural Language Processing

### 5.1 Parse and Create

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| NLP-001 | Simple event parsing | 1. Click "Natural Language"<br>2. Enter: "Team meeting tomorrow at 2pm"<br>3. Click "Create Events" | - Event created with title "Team meeting"<br>- Time preference stored in description |
| NLP-002 | Multiple events | 1. Enter multiple items:<br>"- Standup at 9am<br>- Lunch at noon"<br>2. Click "Create" | - Two todos created<br>- Each with appropriate title |
| NLP-003 | Priority inference | 1. Enter: "URGENT: Call the bank"<br>2. Click "Create" | - Event created with priority 1 (Urgent) |
| NLP-004 | Participant extraction | 1. Enter: "Meeting with John (john@example.com)"<br>2. Click "Create" | - Event created<br>- If john@example.com exists, added as participant |
| NLP-005 | Invalid input | 1. Enter gibberish<br>2. Click "Create" | - Error: "Could not parse the text..." |
| NLP-006 | Empty input | 1. Leave text area empty<br>2. Click "Create" | - Button disabled<br>- No action |

---

## 6. Auto-Scheduling

### 6.1 Basic Auto-Schedule

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| AUTO-001 | Schedule within today | 1. Select todos<br>2. Click "Auto-Schedule"<br>3. Choose "Today"<br>4. Confirm | - Events scheduled within today 9AM-6PM<br>- No conflicts |
| AUTO-002 | Schedule within week | 1. Select todos<br>2. Choose "This Week"<br>3. Confirm | - Events distributed across the week |
| AUTO-003 | Custom date range | 1. Select "Custom Range"<br>2. Set start/end dates<br>3. Confirm | - Events scheduled within custom range |
| AUTO-004 | No available slots | 1. Fill calendar completely<br>2. Try to auto-schedule | - Error: "Could not find available time slots..." |

### 6.2 Priority-Based Scheduling

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| AUTO-005 | Higher priority gets better slot | 1. Create Priority 1 and Priority 5 todos<br>2. Auto-schedule | - Priority 1 gets preferred time slot<br>- Priority 5 gets remaining slot |
| AUTO-006 | Override lower priority | 1. Schedule Priority 5 event<br>2. Auto-schedule Priority 1 event<br>3. Same time slot | - Priority 5 event unscheduled<br>- Priority 1 event takes slot |

---

## 7. UI/UX

### 7.1 Visual Elements

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| UI-001 | Priority color coding | View events with different priorities | - Priority 1 (Urgent): Red<br>- Priority 2 (High): Orange<br>- Priority 3 (Normal): Amber<br>- Priority 4 (Low): Lime<br>- Priority 5 (Optional): Gray |
| UI-002 | Priority bar indicator | View todo items | - Colored bar on left side of each todo<br>- Color matches priority |
| UI-003 | Event modal header | 1. Open event<br>2. Click "Edit" | - Header changes from "Event Details" to "Event Details (Editing)" |
| UI-004 | Selected todos count | 1. Select multiple todos | - Footer shows: "X todo(s) selected" |
| UI-005 | Calendar view switching | 1. Click "Month"<br>2. Click "Week"<br>3. Click "Day" | - Calendar view changes accordingly<br>- Active view highlighted |

### 7.2 Confirmation Modals

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| UI-006 | Delete confirmation | Click delete on todo/event | - Modal with title "Delete Todo/Event"<br>- Warning message displayed<br>- Red "Confirm" button |
| UI-007 | Schedule conflict warning | Schedule with conflict | - Modal with title "Schedule Conflict"<br>- Lists conflicting events<br>- Red "Confirm" button |
| UI-008 | Override warning | Click event with todos selected | - Modal with title "Schedule Todos"<br>- Warning about override<br>- Yellow "Confirm" button |

---

## 8. Priority System

### 8.1 Priority Levels

| Priority | Label | Color | Can Override |
|----------|-------|-------|--------------|
| 1 | Urgent | Red | 2, 3, 4, 5 |
| 2 | High | Orange | 3, 4, 5 |
| 3 | Normal | Amber | 4, 5 |
| 4 | Low | Lime | 5 |
| 5 | Optional | Gray | None |

### 8.2 Priority Tests

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PRI-001 | Override own lower priority | 1. Schedule Priority 3 event at 10AM<br>2. Move Priority 1 event to 10AM | - Priority 3 event unscheduled<br>- Priority 1 event scheduled |
| PRI-002 | Cannot override higher priority | 1. Schedule Priority 1 event at 10AM<br>2. Try to move Priority 3 event to 10AM | - Error: "Conflict with your event..."<br>- Priority 3 event not scheduled |
| PRI-003 | Participant conflict | 1. Event A: User 1 + User 2 at 10AM (Priority 2)<br>2. Event B: User 2 only at 10AM (Priority 1)<br>3. Try to move Event A to 10AM | - Error: "Participant has conflict..." |

---

## 9. Error Handling

### 9.1 Network Errors

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ERR-001 | Backend unavailable | 1. Stop backend server<br>2. Try to create event | - Error: Network error message<br>- Graceful failure |
| ERR-002 | Database error | 1. Cause DB error (e.g., disconnect)<br>2. Try any operation | - Error message displayed<br>- UI remains responsive |

### 9.2 Validation Errors

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ERR-003 | Empty title on update | 1. Edit event<br>2. Clear title<br>3. Save | - Error: "Title is required" |
| ERR-004 | Invalid time range | 1. Edit event time<br>2. Set end before start<br>3. Save | - Error: "End time must be after start time" |
| ERR-005 | Edit non-existent event | 1. Delete event<br>2. Try to edit via direct link | - Error: "Event not found" |

### 9.3 Permission Errors

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ERR-006 | Edit other's event | 1. Login as User A<br>2. Create event<br>3. Login as User B<br>4. Try to edit | - Edit button not visible<br>- View-only mode |
| ERR-007 | Delete other's event | 1. Same as ERR-006<br>2. Try to delete | - Delete button not visible |
| ERR-008 | Add participant to other's event | 1. Same as ERR-006<br>2. Try to add participant | - Add participant UI not visible |

---

## 10. Corner Cases

### 10.1 Time Edge Cases

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CC-001 | Midnight event | 1. Schedule event at 00:00 | - Event created successfully<br>- Displays correctly in calendar |
| CC-002 | Cross-day event | 1. Schedule 23:00-01:00 | - Event may be split or rejected based on business rules |
| CC-003 | Very long event | 1. Schedule 8-hour event | - Event displays correctly<br>- May span multiple calendar cells |
| CC-004 | Back-to-back events | 1. Schedule 9:00-10:00<br>2. Schedule 10:00-11:00 | - Both events scheduled<br>- No gap required |

### 10.2 Data Edge Cases

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CC-005 | Very long title | 1. Create event with 200-char title | - Title truncated in display<br>- Full title in modal |
| CC-006 | Special characters | 1. Create event with emojis/special chars | - Displayed correctly<br>- No encoding issues |
| CC-007 | Duplicate event titles | 1. Create multiple events with same title | - Allowed<br>- Distinguished by time/participants |

### 10.3 Concurrency

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CC-008 | Simultaneous edits | 1. User A and B edit same event simultaneously | - Last write wins<br>- Potential data loss (acceptable for v1) |
| CC-009 | Delete while viewing | 1. User A deletes event<br>2. User B has event modal open | - User B gets error on next action<br>- Modal should handle gracefully |

### 10.4 Browser/Device

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CC-010 | Browser refresh | 1. Select todos<br>2. Refresh page | - Selection cleared<br>- User remains logged in |
| CC-011 | Multiple tabs | 1. Open calendar in 2 tabs<br>2. Create event in Tab 1 | - Tab 2 shows event after refetch |
| CC-012 | Mobile viewport | 1. Open on mobile device<br>2. Check layout | - Two-column layout adapts<br>- May become stacked on small screens |

---

## Notes for Testing

### Test Data Requirements
- At least 3 test users created
- Mix of scheduled and unscheduled events
- Events with various priorities
- Events with multiple participants

### Known Limitations
- Time zones not supported (all times treated as local)
- No recurring events
- No email notifications (in-app only)
- No mobile app (web only)

### Reporting Issues
When reporting bugs, include:
1. Test case ID (if applicable)
2. Steps to reproduce
3. Expected vs actual result
4. Browser and version
5. Screenshots if applicable

---

*End of Test Cases Document*
