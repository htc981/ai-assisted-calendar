-- Test script for event overlap checking in sp_update_event
-- Run this after updating the stored procedure

-- ============================================================
-- Setup: Create test users and events
-- ============================================================

-- Clean up any existing test data
DELETE FROM Log WHERE user_id IN (100, 101, 102);
DELETE FROM Participant WHERE user_id IN (100, 101, 102);
DELETE FROM Event WHERE creator_id IN (100, 101, 102);
DELETE FROM User WHERE user_id IN (100, 101, 102);

-- Create test users
INSERT INTO User (user_id, name, email) VALUES 
    (100, 'Test User 1', 'test1@example.com'),
    (101, 'Test User 2', 'test2@example.com'),
    (102, 'Test User 3', 'test3@example.com');

-- Create test events (all scheduled, no conflicts initially)
-- Event 1: 9:00-10:00, User 100 only, Priority 3
INSERT INTO Event (event_id, creator_id, title, priority, start_time, end_time, status) VALUES
    (1000, 100, 'Morning Meeting', 3, '2026-03-28 09:00:00', '2026-03-28 10:00:00', 'scheduled');

-- Event 2: 10:00-11:00, User 100 only, Priority 3
INSERT INTO Event (event_id, creator_id, title, priority, start_time, end_time, status) VALUES
    (1001, 100, 'Late Morning', 3, '2026-03-28 10:00:00', '2026-03-28 11:00:00', 'scheduled');

-- Event 3: 14:00-15:00, User 100 and 101, Priority 2
INSERT INTO Event (event_id, creator_id, title, priority, start_time, end_time, status) VALUES
    (1002, 100, 'Afternoon Sync', 2, '2026-03-28 14:00:00', '2026-03-28 15:00:00', 'scheduled');

-- Add User 101 as participant to Event 3
INSERT INTO Participant (user_id, event_id, role, response) VALUES
    (101, 1002, 'required', 'accepted');

-- Event 4: 14:00-15:00, User 102 only, Priority 3 (conflicts with Event 3)
INSERT INTO Event (event_id, creator_id, title, priority, start_time, end_time, status) VALUES
    (1003, 102, 'Other Meeting', 3, '2026-03-28 14:00:00', '2026-03-28 15:00:00', 'scheduled');

SELECT '=== Initial State ===' AS '';
SELECT event_id, creator_id, title, priority, start_time, end_time, status FROM Event WHERE event_id IN (1000, 1001, 1002, 1003);

-- ============================================================
-- Test 1: Update event to conflict with own event (should fail)
-- ============================================================
SELECT '' AS '';
SELECT '=== Test 1: Conflict with own event ===' AS '';
SELECT 'Attempting to move Event 1001 to 9:30-10:30 (conflicts with Event 1000)...' AS '';

CALL sp_update_event(1001, NULL, NULL, NULL, '2026-03-28 09:30:00', '2026-03-28 10:30:00', NULL, @success, @message);
SELECT @success AS success, @message AS message;

-- Verify Event 1001 was NOT updated
SELECT event_id, start_time, end_time FROM Event WHERE event_id = 1001;

-- ============================================================
-- Test 2: Update event with higher priority to override (should succeed)
-- ============================================================
SELECT '' AS '';
SELECT '=== Test 2: Higher priority override ===' AS '';
SELECT 'Attempting to move Event 1003 (priority 3) to conflict with Event 1002 (priority 2)...' AS '';
SELECT 'Note: This should FAIL because Event 1003 has LOWER priority (3 > 2)' AS '';

CALL sp_update_event(1003, NULL, NULL, 1, '2026-03-28 14:00:00', '2026-03-28 15:00:00', NULL, @success, @message);
SELECT @success AS success, @message AS message;

-- ============================================================
-- Test 3: Update event to non-conflicting time (should succeed)
-- ============================================================
SELECT '' AS '';
SELECT '=== Test 3: No conflict ===' AS '';
SELECT 'Attempting to move Event 1001 to 11:00-12:00 (no conflict)...' AS '';

CALL sp_update_event(1001, NULL, NULL, NULL, '2026-03-28 11:00:00', '2026-03-28 12:00:00', NULL, @success, @message);
SELECT @success AS success, @message AS message;

-- Verify Event 1001 was updated
SELECT event_id, start_time, end_time FROM Event WHERE event_id = 1001;

-- ============================================================
-- Test 4: Update event with higher priority to override own conflict
-- ============================================================
SELECT '' AS '';
SELECT '=== Test 4: Override own lower priority event ===' AS '';
SELECT 'Attempting to move Event 1000 (priority 3) to 11:00-12:00, but with priority 1...' AS '';
SELECT 'This should override Event 1001 (now at 11:00-12:00, priority 3)' AS '';

CALL sp_update_event(1000, NULL, NULL, 1, '2026-03-28 11:00:00', '2026-03-28 12:00:00', NULL, @success, @message);
SELECT @success AS success, @message AS message;

-- Verify Event 1000 was updated and Event 1001 was unscheduled
SELECT 'Event 1000:' AS '', event_id, start_time, end_time, status FROM Event WHERE event_id = 1000;
SELECT 'Event 1001:' AS '', event_id, start_time, end_time, status FROM Event WHERE event_id = 1001;

-- ============================================================
-- Test 5: Update event that conflicts with participant's other event
-- ============================================================
SELECT '' AS '';
SELECT '=== Test 5: Conflict with participant other event ===' AS '';
SELECT 'Creating Event 1004 for User 101 at 16:00-17:00...' AS '';

INSERT INTO Event (event_id, creator_id, title, priority, start_time, end_time, status) VALUES
    (1004, 101, 'User101 Private', 3, '2026-03-28 16:00:00', '2026-03-28 17:00:00', 'scheduled');

SELECT 'Attempting to move Event 1002 (has User 101) to 16:00-17:00...' AS '';

CALL sp_update_event(1002, NULL, NULL, NULL, '2026-03-28 16:00:00', '2026-03-28 17:00:00', NULL, @success, @message);
SELECT @success AS success, @message AS message;

-- ============================================================
-- Cleanup
-- ============================================================
SELECT '' AS '';
SELECT '=== Final State ===' AS '';
SELECT event_id, creator_id, title, priority, start_time, end_time, status FROM Event WHERE event_id IN (1000, 1001, 1002, 1003, 1004);

-- Clean up test data
DELETE FROM Log WHERE user_id IN (100, 101, 102);
DELETE FROM Participant WHERE user_id IN (100, 101, 102);
DELETE FROM Event WHERE creator_id IN (100, 101, 102);
DELETE FROM User WHERE user_id IN (100, 101, 102);

SELECT 'Test data cleaned up.' AS '';
