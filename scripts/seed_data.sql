-- Seed Data for AI-Assisted Calendar
-- Run after schema.sql to populate sample data

USE calendar;

-- Insert sample users
INSERT INTO User (name, email) VALUES
    ('Alice Johnson', 'alice@example.com'),
    ('Bob Smith', 'bob@example.com'),
    ('Charlie Brown', 'charlie@example.com'),
    ('Diana Lee', 'diana@example.com'),
    ('Eve Wilson', 'eve@example.com');

-- Insert sample events for Alice (user_id = 1)
INSERT INTO Event (creator_id, title, description, priority, start_time, end_time, status, estimated_duration) VALUES
    -- Scheduled events
    (1, 'Daily Standup', 'Team sync meeting', 2, '2026-03-26 09:00:00', '2026-03-26 09:30:00', 'scheduled', 30),
    (1, 'Project Planning', 'Q2 project planning session', 1, '2026-03-26 14:00:00', '2026-03-26 16:00:00', 'scheduled', 120),
    (1, 'Lunch with Client', 'Discuss requirements for new feature', 1, '2026-03-27 12:00:00', '2026-03-27 13:00:00', 'scheduled', 60),
    
    -- Unscheduled todos
    (1, 'Review PR #234', 'Code review for authentication feature', 2, NULL, NULL, 'unscheduled', 45),
    (1, 'Update Documentation', 'Update API docs for v2.0', 3, NULL, NULL, 'unscheduled', 90),
    (1, 'Team Building Event', 'Plan quarterly team building activity', 4, NULL, NULL, 'unscheduled', 60),
    (1, 'Email Inbox Zero', 'Clear out pending emails', 5, NULL, NULL, 'unscheduled', 30),
    (1, 'Security Audit', 'Review security logs and access patterns', 1, NULL, NULL, 'unscheduled', 120);

-- Insert sample events for Bob (user_id = 2)
INSERT INTO Event (creator_id, title, description, priority, start_time, end_time, status, estimated_duration) VALUES
    (2, 'Budget Review', 'Review Q1 budget and forecast Q2', 2, '2026-03-26 10:00:00', '2026-03-26 11:00:00', 'scheduled', 60),
    (2, 'Prepare Presentation', 'Slides for board meeting', 1, NULL, NULL, 'unscheduled', 180);

-- Add participants to events
-- Daily Standup participants
INSERT INTO Participant (user_id, event_id, role, response) VALUES
    (1, 1, 'organizer', 'accepted'),
    (2, 1, 'required', 'accepted'),
    (3, 1, 'required', 'accepted'),
    (4, 1, 'optional', 'tentative');

-- Project Planning participants
INSERT INTO Participant (user_id, event_id, role, response) VALUES
    (1, 2, 'organizer', 'accepted'),
    (2, 2, 'required', 'accepted'),
    (3, 2, 'required', 'pending'),
    (5, 2, 'optional', 'accepted');

-- Lunch with Client participants
INSERT INTO Participant (user_id, event_id, role, response) VALUES
    (1, 3, 'organizer', 'accepted'),
    (4, 3, 'required', 'accepted');

-- Review PR #234 participants
INSERT INTO Participant (user_id, event_id, role, response) VALUES
    (1, 4, 'organizer', 'accepted'),
    (3, 4, 'required', 'pending');

-- Budget Review participants
INSERT INTO Participant (user_id, event_id, role, response) VALUES
    (2, 5, 'organizer', 'accepted'),
    (1, 5, 'required', 'accepted'),
    (5, 5, 'required', 'declined');

-- Insert sample log entries (for demonstration - actual logs are created by triggers)
INSERT INTO Log (time, message, user_id, event_id, action_type) VALUES
    (NOW(), 'Sample data initialized', 1, NULL, 'SYSTEM_INIT');

-- Display summary
SELECT 'Sample Data Summary' AS report;
SELECT 'Users' AS table_name, COUNT(*) AS count FROM User
UNION ALL
SELECT 'Events', COUNT(*) FROM Event
UNION ALL
SELECT 'Participants', COUNT(*) FROM Participant
UNION ALL
SELECT 'Scheduled Events', COUNT(*) FROM Event WHERE status = 'scheduled'
UNION ALL
SELECT 'Unscheduled Todos', COUNT(*) FROM Event WHERE status = 'unscheduled';
