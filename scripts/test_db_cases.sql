-- ============================================================
-- Database Test Cases
-- Run with: mysql -u root -p calendar < scripts/test_db_cases.sql
-- ============================================================

USE calendar;

-- ============================================================
-- Test 1: Create Event Stored Procedure
-- ============================================================
SELECT 'TEST 1: Create Event' AS test_name;

CALL sp_create_event(
    1,  -- creator_id
    'Test TODO Item',
    'This is a test todo created via stored procedure',
    2,  -- priority
    NULL, NULL,  -- start_time, end_time
    'unscheduled',
    60,  -- estimated_duration
    @test_event_id
);

SELECT @test_event_id AS created_event_id;

-- Verify event was created
SELECT 
    CASE 
        WHEN event_id IS NOT NULL AND title = 'Test TODO Item' AND status = 'unscheduled'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result
FROM Event WHERE event_id = @test_event_id;

-- Verify creator was added as participant
SELECT 
    CASE 
        WHEN COUNT(*) = 1 AND MAX(role) = 'organizer'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result
FROM Participant WHERE event_id = @test_event_id;

-- ============================================================
-- Test 2: Add Participant
-- ============================================================
SELECT 'TEST 2: Add Participant' AS test_name;

CALL sp_add_participant(
    @test_event_id,
    2,  -- user_id
    'required',
    @add_success,
    @add_message
);

SELECT @add_success AS success, @add_message AS message;

SELECT 
    CASE 
        WHEN @add_success = 1 THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result;

-- ============================================================
-- Test 3: Update Participant Response
-- ============================================================
SELECT 'TEST 3: Update Participant Response' AS test_name;

CALL sp_update_participant_response(
    @test_event_id,
    2,  -- user_id
    'accepted',
    @resp_success,
    @resp_message
);

SELECT 
    CASE 
        WHEN @resp_success = 1 THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result;

-- Verify response was updated
SELECT 
    CASE 
        WHEN response = 'accepted' THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result
FROM Participant WHERE event_id = @test_event_id AND user_id = 2;

-- ============================================================
-- Test 4: Schedule Todo
-- ============================================================
SELECT 'TEST 4: Schedule Todo' AS test_name;

CALL sp_schedule_todo(
    @test_event_id,
    '2026-03-27 10:00:00',
    '2026-03-27 11:00:00',
    @sched_success,
    @sched_message
);

SELECT 
    CASE 
        WHEN @sched_success = 1 THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result;

-- Verify event was scheduled
SELECT 
    CASE 
        WHEN status = 'scheduled' AND start_time IS NOT NULL
        THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result
FROM Event WHERE event_id = @test_event_id;

-- ============================================================
-- Test 5: Conflict Detection and Override
-- ============================================================
SELECT 'TEST 5: Conflict Detection and Override' AS test_name;

-- Create a low priority scheduled event
CALL sp_create_event(
    1,
    'Low Priority Meeting',
    'This should be overridden',
    4,  -- low priority
    '2026-03-27 10:00:00',  -- same time as test_event
    '2026-03-27 11:00:00',
    'scheduled',
    60,
    @low_priority_id
);

-- Create a high priority unscheduled event
CALL sp_create_event(
    1,
    'High Priority Meeting',
    'This should override',
    1,  -- high priority
    NULL, NULL,
    'unscheduled',
    60,
    @high_priority_id
);

-- Try to schedule high priority event at same time
CALL sp_schedule_todo(
    @high_priority_id,
    '2026-03-27 10:00:00',
    '2026-03-27 11:00:00',
    @override_success,
    @override_message
);

-- Verify high priority was scheduled
SELECT 
    CASE 
        WHEN (SELECT status FROM Event WHERE event_id = @high_priority_id) = 'scheduled'
        THEN 'PASS: High priority scheduled'
        ELSE 'FAIL: High priority not scheduled'
    END AS test_result;

-- Verify low priority was bumped to unscheduled
SELECT 
    CASE 
        WHEN (SELECT status FROM Event WHERE event_id = @low_priority_id) = 'unscheduled'
        THEN 'PASS: Low priority bumped'
        ELSE 'FAIL: Low priority not bumped'
    END AS test_result;

-- ============================================================
-- Test 6: Logging Triggers
-- ============================================================
SELECT 'TEST 6: Logging Triggers' AS test_name;

-- Check that events were logged
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result
FROM Log WHERE event_id = @test_event_id;

-- Show recent logs
SELECT log_id, time, message, action_type 
FROM Log 
ORDER BY log_id DESC 
LIMIT 5;

-- ============================================================
-- Test 7: Cancel Event
-- ============================================================
SELECT 'TEST 7: Cancel Event' AS test_name;

CALL sp_cancel_event(
    @low_priority_id,
    @cancel_success,
    @cancel_message
);

SELECT 
    CASE 
        WHEN @cancel_success = 1 THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result;

-- Verify status changed to cancelled
SELECT 
    CASE 
        WHEN status = 'cancelled' THEN 'PASS'
        ELSE 'FAIL'
    END AS test_result
FROM Event WHERE event_id = @low_priority_id;

-- ============================================================
-- Test 8: Same Priority Conflict (Older Wins)
-- ============================================================
SELECT 'TEST 8: Same Priority - Older Event Wins' AS test_name;

-- Create two events with same priority
CALL sp_create_event(
    1,
    'Older Event',
    'Created first',
    3,
    NULL, NULL,
    'unscheduled',
    60,
    @older_id
);

CALL sp_create_event(
    1,
    'Newer Event',
    'Created second',
    3,
    NULL, NULL,
    'unscheduled',
    60,
    @newer_id
);

-- Schedule older event first
CALL sp_schedule_todo(
    @older_id,
    '2026-03-28 10:00:00',
    '2026-03-28 11:00:00',
    @s1, @m1
);

-- Try to schedule newer event at same time
CALL sp_schedule_todo(
    @newer_id,
    '2026-03-28 10:00:00',
    '2026-03-28 11:00:00',
    @s2, @m2
);

-- Older should remain scheduled, newer should fail or be unscheduled
SELECT 
    CASE 
        WHEN (SELECT status FROM Event WHERE event_id = @older_id) = 'scheduled'
        THEN 'PASS: Older event kept'
        ELSE 'FAIL: Older event not kept'
    END AS test_result;

-- ============================================================
-- Cleanup
-- ============================================================
SELECT 'CLEANUP' AS status;

-- Delete test events
DELETE FROM Participant WHERE event_id IN (
    @test_event_id, @low_priority_id, @high_priority_id, @older_id, @newer_id
);
DELETE FROM Event WHERE event_id IN (
    @test_event_id, @low_priority_id, @high_priority_id, @older_id, @newer_id
);

SELECT 'All tests completed!' AS status;

-- ============================================================
-- Summary Query
-- ============================================================
SELECT 
    'Test Summary' AS report,
    COUNT(*) AS total_tests,
    SUM(CASE WHEN test_result LIKE '%PASS%' THEN 1 ELSE 0 END) AS passed,
    SUM(CASE WHEN test_result LIKE '%FAIL%' THEN 1 ELSE 0 END) AS failed
FROM (
    -- This would need to be captured differently in actual test runner
    SELECT 'N/A' AS test_result
) AS results;
