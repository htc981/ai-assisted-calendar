-- AI-Assisted Calendar Database Schema
-- MySQL 8.0+
-- All business logic implemented at database level

-- ============================================================
-- DROP EXISTING OBJECTS (for clean re-install)
-- ============================================================
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Log;
DROP TABLE IF EXISTS Participant;
DROP TABLE IF EXISTS Event;
DROP TABLE IF EXISTS User;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- TABLES
-- ============================================================

-- User table
CREATE TABLE IF NOT EXISTS User (
    user_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Event table (stores both todos and scheduled events)
CREATE TABLE IF NOT EXISTS Event (
    event_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    creator_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    start_time DATETIME,
    end_time DATETIME,
    status VARCHAR(20) NOT NULL DEFAULT 'unscheduled' 
        CHECK (status IN ('unscheduled', 'scheduled', 'cancelled')),
    estimated_duration INTEGER, -- in minutes, for AI-estimated duration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES User(user_id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_creator (creator_id),
    INDEX idx_times (start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Participant table (many-to-many relationship between User and Event)
CREATE TABLE IF NOT EXISTS Participant (
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'required' 
        CHECK (role IN ('organizer', 'required', 'optional')),
    response VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (response IN ('pending', 'accepted', 'declined', 'tentative')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, event_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Event(event_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Log table (audit trail for all operations)
CREATE TABLE IF NOT EXISTS Log (
    log_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    message TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    event_id INTEGER,
    action_type VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Event(event_id) ON DELETE SET NULL,
    INDEX idx_time (time),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notification table (internal mailbox for event invitations)
CREATE TABLE IF NOT EXISTS Notification (
    notification_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,  -- Recipient
    from_user_id INTEGER NOT NULL,  -- Sender
    event_id INTEGER NOT NULL,
    notification_type VARCHAR(50) NOT NULL,  -- 'invitation', 'update', 'cancellation'
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_taken VARCHAR(20) DEFAULT NULL,  -- 'accepted', 'declined', 'tentative', NULL if pending
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Event(event_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Drop existing objects first (must run as root)
DROP FUNCTION IF EXISTS has_time_overlap;
DROP FUNCTION IF EXISTS check_user_conflict;
DROP FUNCTION IF EXISTS has_user_accepted;
DROP FUNCTION IF EXISTS get_conflict_to_override;
DROP FUNCTION IF EXISTS check_all_participants_available;
DROP FUNCTION IF EXISTS find_next_available_slot;
DROP PROCEDURE IF EXISTS sp_create_event;
DROP PROCEDURE IF EXISTS sp_add_participant;
DROP PROCEDURE IF EXISTS sp_update_participant_response;
DROP PROCEDURE IF EXISTS sp_remove_participant;
DROP PROCEDURE IF EXISTS sp_schedule_todo;
DROP PROCEDURE IF EXISTS sp_update_event;
DROP PROCEDURE IF EXISTS sp_cancel_event;
DROP PROCEDURE IF EXISTS sp_delete_event;
DROP PROCEDURE IF EXISTS sp_auto_schedule;
DROP PROCEDURE IF EXISTS sp_create_notification;
DROP PROCEDURE IF EXISTS sp_mark_notification_read;
DROP PROCEDURE IF EXISTS sp_get_unread_count;
DROP PROCEDURE IF EXISTS sp_get_notifications;
DROP TRIGGER IF EXISTS trg_event_insert;
DROP TRIGGER IF EXISTS trg_event_update;
DROP TRIGGER IF EXISTS trg_event_delete;
DROP TRIGGER IF EXISTS trg_participant_insert;
DROP TRIGGER IF EXISTS trg_participant_update;
DROP TRIGGER IF EXISTS trg_participant_delete;

DELIMITER //

-- Function to check if two time ranges overlap
CREATE FUNCTION has_time_overlap(
    start1 DATETIME, end1 DATETIME,
    start2 DATETIME, end2 DATETIME
) RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    IF start1 IS NULL OR start2 IS NULL THEN
        RETURN FALSE;
    END IF;
    IF end1 IS NULL THEN
        SET end1 = DATE_ADD(start1, INTERVAL 60 MINUTE);
    END IF;
    IF end2 IS NULL THEN
        SET end2 = DATE_ADD(start2, INTERVAL 60 MINUTE);
    END IF;
    RETURN start1 < end2 AND end1 > start2;
END //

-- Function to check if a user has a conflict with a given time range
-- Returns the conflicting event_id, or NULL if no conflict
CREATE FUNCTION check_user_conflict(
    p_user_id INTEGER,
    p_start_time DATETIME,
    p_end_time DATETIME,
    p_exclude_event_id INTEGER
) RETURNS INTEGER
READS SQL DATA
BEGIN
    DECLARE v_conflict_event_id INTEGER DEFAULT NULL;
    
    SELECT e.event_id INTO v_conflict_event_id
    FROM Event e
    INNER JOIN Participant p ON e.event_id = p.event_id
    WHERE p.user_id = p_user_id
      AND e.status = 'scheduled'
      AND e.event_id != COALESCE(p_exclude_event_id, -1)
      AND e.start_time IS NOT NULL
      AND e.end_time IS NOT NULL
      AND has_time_overlap(e.start_time, e.end_time, p_start_time, p_end_time)
    LIMIT 1;
    
    RETURN v_conflict_event_id;
END //

-- Function to check if a user has accepted an event
CREATE FUNCTION has_user_accepted(
    p_user_id INTEGER,
    p_event_id INTEGER
) RETURNS BOOLEAN
READS SQL DATA
BEGIN
    DECLARE v_response VARCHAR(20);
    
    SELECT response INTO v_response
    FROM Participant
    WHERE user_id = p_user_id AND event_id = p_event_id;
    
    RETURN v_response = 'accepted';
END //

-- Function to get the best conflicting event (highest priority, or oldest if same)
CREATE FUNCTION get_conflict_to_override(
    p_user_id INTEGER,
    p_start_time DATETIME,
    p_end_time DATETIME,
    p_new_priority INTEGER,
    p_new_event_id INTEGER
) RETURNS INTEGER
READS SQL DATA
BEGIN
    DECLARE v_conflict_event_id INTEGER DEFAULT NULL;
    
    -- Find conflicting event that can be overridden
    -- Priority: new event wins if higher priority
    -- If same priority, older event (lower event_id) wins
    SELECT e.event_id INTO v_conflict_event_id
    FROM Event e
    INNER JOIN Participant p ON e.event_id = p.event_id
    WHERE p.user_id = p_user_id
      AND e.status = 'scheduled'
      AND e.event_id != COALESCE(p_new_event_id, -1)
      AND e.start_time IS NOT NULL
      AND e.end_time IS NOT NULL
      AND has_time_overlap(e.start_time, e.end_time, p_start_time, p_end_time)
      AND (e.priority > p_new_priority 
           OR (e.priority = p_new_priority AND e.event_id > p_new_event_id))
    ORDER BY e.priority DESC, e.event_id DESC
    LIMIT 1;
    
    RETURN v_conflict_event_id;
END //

-- Function to check if ALL accepting participants can accommodate the time
-- Returns 0 if all clear, or user_id of the blocking participant
CREATE FUNCTION check_all_participants_available(
    p_event_id INTEGER,
    p_start_time DATETIME,
    p_end_time DATETIME
) RETURNS INTEGER
READS SQL DATA
BEGIN
    DECLARE v_blocking_user_id INTEGER DEFAULT NULL;
    
    -- Check only participants who have accepted
    -- A participant blocks if they have an accepted event at that time with higher/equal priority
    SELECT p.user_id INTO v_blocking_user_id
    FROM Participant p
    WHERE p.event_id = p_event_id
      AND p.response = 'accepted'
      AND EXISTS (
          SELECT 1 FROM Event e2
          INNER JOIN Participant p2 ON e2.event_id = p2.event_id
          WHERE p2.user_id = p.user_id
            AND e2.status = 'scheduled'
            AND e2.event_id != p_event_id
            AND e2.start_time IS NOT NULL
            AND e2.end_time IS NOT NULL
            AND has_time_overlap(e2.start_time, e2.end_time, p_start_time, p_end_time)
            AND (e2.priority < (SELECT priority FROM Event WHERE event_id = p_event_id)
                 OR (e2.priority = (SELECT priority FROM Event WHERE event_id = p_event_id) 
                     AND e2.event_id < p_event_id))
      )
    LIMIT 1;
    
    RETURN v_blocking_user_id;
END //

-- ============================================================
-- LOGGING TRIGGER (Automatic logging for all changes)
-- ============================================================

-- Trigger to log Event changes
CREATE TRIGGER trg_event_insert
AFTER INSERT ON Event
FOR EACH ROW
BEGIN
    INSERT INTO Log (time, message, user_id, event_id, action_type)
    VALUES (NOW(), CONCAT('Created event "', NEW.title, '"'), NEW.creator_id, NEW.event_id, 'EVENT_CREATE');
END //

CREATE TRIGGER trg_event_update
AFTER UPDATE ON Event
FOR EACH ROW
BEGIN
    DECLARE v_message TEXT;
    SET v_message = CONCAT('Updated event "', NEW.title, '"');
    
    IF OLD.status != NEW.status THEN
        SET v_message = CONCAT(v_message, ', status: ', OLD.status, ' -> ', NEW.status);
    END IF;
    
    IF OLD.start_time != NEW.start_time OR OLD.end_time != NEW.end_time THEN
        SET v_message = CONCAT(v_message, ', time changed');
    END IF;
    
    INSERT INTO Log (time, message, user_id, event_id, action_type)
    VALUES (NOW(), v_message, NEW.creator_id, NEW.event_id, 'EVENT_UPDATE');
END //

CREATE TRIGGER trg_event_delete
BEFORE DELETE ON Event
FOR EACH ROW
BEGIN
    INSERT INTO Log (time, message, user_id, event_id, action_type)
    VALUES (NOW(), CONCAT('Deleted event "', OLD.title, '"'), OLD.creator_id, OLD.event_id, 'EVENT_DELETE');
END //

-- Trigger to log Participant changes
CREATE TRIGGER trg_participant_insert
AFTER INSERT ON Participant
FOR EACH ROW
BEGIN
    INSERT INTO Log (time, message, user_id, event_id, action_type)
    VALUES (NOW(), CONCAT('Added participant to event'), NEW.user_id, NEW.event_id, 'PARTICIPANT_ADD');
END //

CREATE TRIGGER trg_participant_update
AFTER UPDATE ON Participant
FOR EACH ROW
BEGIN
    IF OLD.response != NEW.response THEN
        INSERT INTO Log (time, message, user_id, event_id, action_type)
        VALUES (NOW(), CONCAT('Updated response: ', OLD.response, ' -> ', NEW.response), 
                NEW.user_id, NEW.event_id, 'PARTICIPANT_RESPONSE');
    END IF;
END //

CREATE TRIGGER trg_participant_delete
BEFORE DELETE ON Participant
FOR EACH ROW
BEGIN
    INSERT INTO Log (time, message, user_id, event_id, action_type)
    VALUES (NOW(), CONCAT('Removed participant from event'), OLD.user_id, OLD.event_id, 'PARTICIPANT_REMOVE');
END //

-- ============================================================
-- STORED PROCEDURES (All write operations)
-- ============================================================

-- Procedure to create a new event/todo
CREATE PROCEDURE sp_create_event(
    IN p_creator_id INTEGER,
    IN p_title VARCHAR(200),
    IN p_description TEXT,
    IN p_priority INTEGER,
    IN p_start_time DATETIME,
    IN p_end_time DATETIME,
    IN p_status VARCHAR(20),
    IN p_estimated_duration INTEGER,
    OUT p_event_id INTEGER
)
BEGIN
    DECLARE v_status VARCHAR(20);
    
    -- Determine status based on time fields
    SET v_status = COALESCE(p_status, 
        CASE WHEN p_start_time IS NOT NULL AND p_end_time IS NOT NULL 
             THEN 'scheduled' ELSE 'unscheduled' END);
    
    -- Validate priority
    IF p_priority IS NULL OR p_priority < 1 OR p_priority > 5 THEN
        SET p_priority = 3;
    END IF;
    
    -- Insert event
    INSERT INTO Event (creator_id, title, description, priority, start_time, end_time, 
                       status, estimated_duration)
    VALUES (p_creator_id, p_title, p_description, p_priority, p_start_time, p_end_time,
            v_status, p_estimated_duration);
    
    SET p_event_id = LAST_INSERT_ID();
    
    -- Add creator as organizer participant
    INSERT INTO Participant (user_id, event_id, role, response)
    VALUES (p_creator_id, p_event_id, 'organizer', 'accepted');
END //

-- Procedure to add a participant to an event
CREATE PROCEDURE sp_add_participant(
    IN p_event_id INTEGER,
    IN p_user_id INTEGER,
    IN p_role VARCHAR(20),
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_event_exists INTEGER;
    DECLARE v_user_exists INTEGER;
    DECLARE v_already_participant INTEGER;
    
    -- Check if event exists
    SELECT COUNT(*) INTO v_event_exists FROM Event WHERE event_id = p_event_id;
    
    -- Check if user exists
    SELECT COUNT(*) INTO v_user_exists FROM User WHERE user_id = p_user_id;
    
    -- Check if already a participant
    SELECT COUNT(*) INTO v_already_participant FROM Participant 
    WHERE event_id = p_event_id AND user_id = p_user_id;
    
    IF v_event_exists = 0 THEN
        SET p_success = FALSE;
        SET p_message = 'Event does not exist';
    ELSEIF v_user_exists = 0 THEN
        SET p_success = FALSE;
        SET p_message = 'User does not exist';
    ELSEIF v_already_participant > 0 THEN
        SET p_success = FALSE;
        SET p_message = 'User is already a participant';
    ELSE
        -- Validate role
        IF p_role NOT IN ('organizer', 'required', 'optional') THEN
            SET p_role = 'required';
        END IF;

        -- Add participant
        INSERT INTO Participant (user_id, event_id, role, response)
        VALUES (p_user_id, p_event_id, p_role, 'pending');

        -- Create notification for the participant
        CALL sp_create_notification(
            p_user_id,
            p_creator_id,
            p_event_id,
            'invitation',
            CONCAT('You have been invited to "', (SELECT title FROM Event WHERE event_id = p_event_id), '"'),
            @notif_id
        );

        SET p_success = TRUE;
        SET p_message = 'Participant added successfully';
    END IF;
END //

-- Procedure to update participant response
CREATE PROCEDURE sp_update_participant_response(
    IN p_event_id INTEGER,
    IN p_user_id INTEGER,
    IN p_response VARCHAR(20),
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_exists INTEGER;
    
    -- Check if participant exists
    SELECT COUNT(*) INTO v_exists FROM Participant 
    WHERE event_id = p_event_id AND user_id = p_user_id;
    
    IF v_exists = 0 THEN
        SET p_success = FALSE;
        SET p_message = 'Participant not found for this event';
    ELSEIF p_response NOT IN ('pending', 'accepted', 'declined', 'tentative') THEN
        SET p_success = FALSE;
        SET p_message = 'Invalid response value';
    ELSE
        UPDATE Participant 
        SET response = p_response
        WHERE event_id = p_event_id AND user_id = p_user_id;
        
        SET p_success = TRUE;
        SET p_message = 'Response updated successfully';
    END IF;
END //

-- Procedure to remove a participant
CREATE PROCEDURE sp_remove_participant(
    IN p_event_id INTEGER,
    IN p_user_id INTEGER,
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_exists INTEGER;
    DECLARE v_is_creator INTEGER;
    
    -- Check if participant exists
    SELECT COUNT(*) INTO v_exists FROM Participant 
    WHERE event_id = p_event_id AND user_id = p_user_id;
    
    -- Check if trying to remove creator
    SELECT COUNT(*) INTO v_is_creator FROM Event 
    WHERE event_id = p_event_id AND creator_id = p_user_id;
    
    IF v_exists = 0 THEN
        SET p_success = FALSE;
        SET p_message = 'Participant not found for this event';
    ELSEIF v_is_creator > 0 THEN
        SET p_success = FALSE;
        SET p_message = 'Cannot remove the event creator';
    ELSE
        DELETE FROM Participant 
        WHERE event_id = p_event_id AND user_id = p_user_id;
        
        SET p_success = TRUE;
        SET p_message = 'Participant removed successfully';
    END IF;
END //

-- Procedure to schedule a todo (set time and move to scheduled)
CREATE PROCEDURE sp_schedule_todo(
    IN p_event_id INTEGER,
    IN p_start_time DATETIME,
    IN p_end_time DATETIME,
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    -- All DECLAREs must be at the top
    DECLARE v_status VARCHAR(20);
    DECLARE v_priority INTEGER;
    DECLARE v_creator_id INTEGER;
    DECLARE v_conflict_event_id INTEGER;
    DECLARE v_conflict_user_id INTEGER;
    DECLARE v_conflict_priority INTEGER;
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_user_id INTEGER;
    DECLARE conflict_cursor CURSOR FOR
        SELECT user_id FROM Participant WHERE event_id = p_event_id AND response IN ('accepted', 'pending');
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Get event details
    SELECT status, priority, creator_id INTO v_status, v_priority, v_creator_id
    FROM Event WHERE event_id = p_event_id;

    IF v_status IS NULL THEN
        SET p_success = FALSE;
        SET p_message = 'Event not found';
    ELSEIF v_status = 'cancelled' THEN
        SET p_success = FALSE;
        SET p_message = 'Cannot schedule a cancelled event';
    ELSEIF p_start_time IS NULL OR p_end_time IS NULL THEN
        SET p_success = FALSE;
        SET p_message = 'Start time and end time are required';
    ELSEIF p_start_time >= p_end_time THEN
        SET p_success = FALSE;
        SET p_message = 'End time must be after start time';
    ELSE
        -- Check conflicts for creator first
        SET v_conflict_event_id = check_user_conflict(v_creator_id, p_start_time, p_end_time, p_event_id);
        
        IF v_conflict_event_id IS NOT NULL THEN
            -- Get conflicting event's priority
            SELECT priority INTO v_conflict_priority FROM Event WHERE event_id = v_conflict_event_id;
            
            -- Can override if new event has higher priority (lower number)
            IF v_priority < v_conflict_priority THEN
                -- Override - set conflicting event to unscheduled
                UPDATE Event SET status = 'unscheduled', start_time = NULL, end_time = NULL
                WHERE event_id = v_conflict_event_id;
            ELSE
                -- Cannot override creator's own event
                SET p_success = FALSE;
                SET p_message = CONCAT('Conflict: You has event ', v_conflict_event_id, ' with higher priority. Choose a different time.');
            END IF;
        END IF;
        
        -- If no creator conflict, check participants
        IF p_success IS NULL OR p_success != FALSE THEN
            OPEN conflict_cursor;
            read_loop: LOOP
                FETCH conflict_cursor INTO v_user_id;
                IF done THEN
                    LEAVE read_loop;
                END IF;

                -- Skip creator (already checked)
                IF v_user_id = v_creator_id THEN
                    ITERATE read_loop;
                END IF;

                -- Check for conflicts
                SET v_conflict_event_id = check_user_conflict(v_user_id, p_start_time, p_end_time, p_event_id);

                IF v_conflict_event_id IS NOT NULL THEN
                    -- Get conflicting event's priority
                    SELECT priority INTO v_conflict_priority FROM Event WHERE event_id = v_conflict_event_id;
                    
                    -- Can override if new event has higher priority (lower number)
                    IF v_priority < v_conflict_priority THEN
                        -- Override - set conflicting event to unscheduled
                        UPDATE Event SET status = 'unscheduled', start_time = NULL, end_time = NULL
                        WHERE event_id = v_conflict_event_id;
                    ELSE
                        -- Cannot override - participant has higher/equal priority event
                        SET p_success = FALSE;
                        SET p_message = CONCAT('Participant has conflict with event ', v_conflict_event_id);
                        CLOSE conflict_cursor;
                        LEAVE read_loop;
                    END IF;
                END IF;
            END LOOP;
            CLOSE conflict_cursor;
        END IF;

        IF p_success IS NULL OR p_success != FALSE THEN
            -- Schedule the event
            UPDATE Event
            SET start_time = p_start_time,
                end_time = p_end_time,
                status = 'scheduled'
            WHERE event_id = p_event_id;

            SET p_success = TRUE;
            SET p_message = 'Event scheduled successfully';
        END IF;
    END IF;
END //

-- Procedure to update an event
CREATE PROCEDURE sp_update_event(
    IN p_event_id INTEGER,
    IN p_title VARCHAR(200),
    IN p_description TEXT,
    IN p_priority INTEGER,
    IN p_start_time DATETIME,
    IN p_end_time DATETIME,
    IN p_status VARCHAR(20),
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_exists INTEGER;
    DECLARE v_current_status VARCHAR(20);
    DECLARE v_creator_id INTEGER;
    DECLARE v_priority INTEGER;
    DECLARE v_conflict_event_id INTEGER;
    DECLARE v_conflict_user_id INTEGER;
    DECLARE v_conflict_priority INTEGER;
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_user_id INTEGER;
    DECLARE conflict_cursor CURSOR FOR
        SELECT user_id FROM Participant WHERE event_id = p_event_id AND response IN ('accepted', 'pending');
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Check if event exists and get current details
    SELECT status, creator_id, priority INTO v_current_status, v_creator_id, v_priority
    FROM Event WHERE event_id = p_event_id;

    IF v_current_status IS NULL THEN
        SET p_success = FALSE;
        SET p_message = 'Event not found';
    ELSEIF p_priority IS NOT NULL AND (p_priority < 1 OR p_priority > 5) THEN
        SET p_success = FALSE;
        SET p_message = 'Priority must be between 1 and 5';
    ELSEIF p_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN
        -- Only check conflicts if time is being set/changed
        IF p_start_time >= p_end_time THEN
            SET p_success = FALSE;
            SET p_message = 'End time must be after start time';
        ELSE
            -- Check conflicts for creator first
            SET v_conflict_event_id = check_user_conflict(v_creator_id, p_start_time, p_end_time, p_event_id);

            IF v_conflict_event_id IS NOT NULL THEN
                -- Get conflicting event's priority
                SELECT priority INTO v_conflict_priority FROM Event WHERE event_id = v_conflict_event_id;

                -- Can override if new event has higher priority (lower number)
                IF v_priority < v_conflict_priority THEN
                    -- Override - set conflicting event to unscheduled
                    UPDATE Event SET status = 'unscheduled', start_time = NULL, end_time = NULL
                    WHERE event_id = v_conflict_event_id;
                ELSE
                    -- Cannot override creator's own event (conflicting event has higher or equal priority)
                    SET p_success = FALSE;
                    SET p_message = CONCAT('Conflict: Event ', v_conflict_event_id, ' has higher priority. Unschedule it first or choose a different time.');
                END IF;
            END IF;

            -- If no creator conflict, check participants
            IF p_success IS NULL OR p_success != FALSE THEN
                OPEN conflict_cursor;
                read_loop: LOOP
                    FETCH conflict_cursor INTO v_user_id;
                    IF done THEN
                        LEAVE read_loop;
                    END IF;

                    -- Skip creator (already checked)
                    IF v_user_id = v_creator_id THEN
                        ITERATE read_loop;
                    END IF;

                    -- Check for conflicts
                    SET v_conflict_event_id = check_user_conflict(v_user_id, p_start_time, p_end_time, p_event_id);

                    IF v_conflict_event_id IS NOT NULL THEN
                        -- Get conflicting event's priority
                        SELECT priority INTO v_conflict_priority FROM Event WHERE event_id = v_conflict_event_id;

                        -- Can override if new event has higher priority (lower number)
                        IF v_priority < v_conflict_priority THEN
                            -- Override - set conflicting event to unscheduled
                            UPDATE Event SET status = 'unscheduled', start_time = NULL, end_time = NULL
                            WHERE event_id = v_conflict_event_id;
                        ELSE
                            -- Cannot override - participant has higher/equal priority event
                            SET p_success = FALSE;
                            SET p_message = CONCAT('Conflict: Participant has event ', v_conflict_event_id, ' with higher priority. Choose a different time.');
                            CLOSE conflict_cursor;
                            LEAVE read_loop;
                        END IF;
                    END IF;
                END LOOP;
                CLOSE conflict_cursor;
            END IF;

            -- If no conflicts (or all overridden), update the event
            IF p_success IS NULL OR p_success != FALSE THEN
                UPDATE Event
                SET title = COALESCE(p_title, title),
                    description = COALESCE(p_description, description),
                    priority = COALESCE(p_priority, priority),
                    start_time = p_start_time,
                    end_time = p_end_time,
                    status = COALESCE(p_status, status)
                WHERE event_id = p_event_id;

                SET p_success = TRUE;
                SET p_message = 'Event updated successfully';
            END IF;
        END IF;
    ELSE
        -- No time provided (unscheduling or just updating other fields)
        UPDATE Event
        SET title = COALESCE(p_title, title),
            description = COALESCE(p_description, description),
            priority = COALESCE(p_priority, priority),
            start_time = p_start_time,  -- Allow NULL to unschedule
            end_time = p_end_time,      -- Allow NULL to unschedule
            status = COALESCE(p_status, status)
        WHERE event_id = p_event_id;

        SET p_success = TRUE;
        SET p_message = 'Event updated successfully';
    END IF;
END //

-- Procedure to cancel an event (soft delete)
CREATE PROCEDURE sp_cancel_event(
    IN p_event_id INTEGER,
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_exists INTEGER;
    DECLARE v_status VARCHAR(20);
    
    SELECT COUNT(*), status INTO v_exists, v_status
    FROM Event WHERE event_id = p_event_id
    GROUP BY status;
    
    IF v_exists = 0 THEN
        SET p_success = FALSE;
        SET p_message = 'Event not found';
    ELSEIF v_status = 'cancelled' THEN
        SET p_success = FALSE;
        SET p_message = 'Event is already cancelled';
    ELSE
        UPDATE Event SET status = 'cancelled'
        WHERE event_id = p_event_id;
        
        SET p_success = TRUE;
        SET p_message = 'Event cancelled successfully';
    END IF;
END //

-- Procedure to delete an event (hard delete)
CREATE PROCEDURE sp_delete_event(
    IN p_event_id INTEGER,
    IN p_user_id INTEGER,
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_exists INTEGER;
    DECLARE v_is_creator INTEGER;
    
    SELECT COUNT(*) INTO v_exists FROM Event WHERE event_id = p_event_id;
    SELECT COUNT(*) INTO v_is_creator FROM Event WHERE event_id = p_event_id AND creator_id = p_user_id;
    
    IF v_exists = 0 THEN
        SET p_success = FALSE;
        SET p_message = 'Event not found';
    ELSEIF v_is_creator = 0 THEN
        SET p_success = FALSE;
        SET p_message = 'Only the creator can delete this event';
    ELSE
        DELETE FROM Event WHERE event_id = p_event_id;
        
        SET p_success = TRUE;
        SET p_message = 'Event deleted successfully';
    END IF;
END //

-- Procedure for auto-scheduling multiple events
CREATE PROCEDURE sp_auto_schedule(
    IN p_event_ids_json TEXT,  -- JSON array of event IDs
    IN p_range_start DATETIME,
    IN p_range_end DATETIME,
    IN p_user_id INTEGER,
    OUT p_success BOOLEAN,
    OUT p_message TEXT
)
BEGIN
    DECLARE v_event_id INTEGER;
    DECLARE v_priority INTEGER;
    DECLARE v_duration INT;
    DECLARE v_start DATETIME;
    DECLARE v_end DATETIME;
    DECLARE v_conflict_event_id INTEGER;
    DECLARE v_done INT DEFAULT FALSE;
    DECLARE v_scheduled_count INT DEFAULT 0;
    DECLARE v_overridden_events TEXT DEFAULT '';
    DECLARE v_error_message TEXT DEFAULT '';
    DECLARE v_sched_success BOOLEAN;
    DECLARE v_sched_message TEXT;

    -- Cursor for events to schedule (ordered by priority)
    DECLARE event_cursor CURSOR FOR
        SELECT event_id, priority, COALESCE(estimated_duration, 60) as duration
        FROM Event
        WHERE FIND_IN_SET(event_id, p_event_ids_json)
          AND status = 'unscheduled'
        ORDER BY priority ASC, event_id ASC;  -- Lower priority number = higher priority

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN event_cursor;

    schedule_loop: LOOP
        FETCH event_cursor INTO v_event_id, v_priority, v_duration;

        IF v_done THEN
            LEAVE schedule_loop;
        END IF;

        -- Find available slot for this event
        SET v_start = p_range_start;
        SET v_end = DATE_ADD(v_start, INTERVAL v_duration MINUTE);
        SET v_conflict_event_id = NULL;

        -- Try to find a slot (simple algorithm: try every 30 min)
        slot_loop: LOOP
            IF v_end > p_range_end THEN
                SET v_error_message = CONCAT(v_error_message,
                    'Event ', v_event_id, ': No available slot in range. ');
                LEAVE slot_loop;
            END IF;

            -- Check for conflicts
            SELECT check_user_conflict(p_user_id, v_start, v_end, v_event_id)
            INTO v_conflict_event_id;

            IF v_conflict_event_id IS NULL THEN
                -- No conflict, schedule this event
                CALL sp_schedule_todo(v_event_id, v_start, v_end, v_sched_success, v_sched_message);

                IF v_sched_success THEN
                    SET v_scheduled_count = v_scheduled_count + 1;
                ELSE
                    SET v_error_message = CONCAT(v_error_message, v_sched_message, ' ');
                END IF;
                LEAVE slot_loop;
            ELSE
                -- Check if we can override
                IF EXISTS (
                    SELECT 1 FROM Event e
                    WHERE e.event_id = v_conflict_event_id
                    AND (e.priority > v_priority
                         OR (e.priority = v_priority AND e.event_id > v_event_id))
                ) THEN
                    -- Override the conflicting event
                    UPDATE Event
                    SET status = 'unscheduled', start_time = NULL, end_time = NULL
                    WHERE event_id = v_conflict_event_id;

                    IF v_overridden_events = '' THEN
                        SET v_overridden_events = CAST(v_conflict_event_id AS CHAR);
                    ELSE
                        SET v_overridden_events = CONCAT(v_overridden_events, ',', v_conflict_event_id);
                    END IF;

                    -- Now schedule the current event
                    CALL sp_schedule_todo(v_event_id, v_start, v_end, v_sched_success, v_sched_message);

                    IF v_sched_success THEN
                        SET v_scheduled_count = v_scheduled_count + 1;
                    END IF;
                    LEAVE slot_loop;
                ELSE
                    -- Try next slot (30 min later)
                    SET v_start = DATE_ADD(v_start, INTERVAL 30 MINUTE);
                    SET v_end = DATE_ADD(v_start, INTERVAL v_duration MINUTE);
                END IF;
            END IF;
        END LOOP slot_loop;
    END LOOP schedule_loop;

    CLOSE event_cursor;

    IF v_scheduled_count > 0 THEN
        SET p_success = TRUE;
        SET p_message = CONCAT('Scheduled ', v_scheduled_count, ' events.');
        IF v_overridden_events != '' THEN
            SET p_message = CONCAT(p_message, ' Overridden events: ', v_overridden_events);
        END IF;
        IF v_error_message != '' THEN
            SET p_message = CONCAT(p_message, ' Issues: ', v_error_message);
        END IF;
    ELSE
        SET p_success = FALSE;
        SET p_message = CONCAT('Failed to schedule any events. ', v_error_message);
    END IF;
END //

-- Procedure to create a notification
CREATE PROCEDURE sp_create_notification(
    IN p_user_id INTEGER,
    IN p_from_user_id INTEGER,
    IN p_event_id INTEGER,
    IN p_notification_type VARCHAR(50),
    IN p_message TEXT,
    OUT p_notification_id INTEGER
)
BEGIN
    INSERT INTO Notification (user_id, from_user_id, event_id, notification_type, message)
    VALUES (p_user_id, p_from_user_id, p_event_id, p_notification_type, p_message);
    
    SET p_notification_id = LAST_INSERT_ID();
END //

-- Procedure to mark notification as read
CREATE PROCEDURE sp_mark_notification_read(
    IN p_notification_id INTEGER,
    IN p_user_id INTEGER,
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_exists INTEGER;
    
    SELECT COUNT(*) INTO v_exists FROM Notification
    WHERE notification_id = p_notification_id AND user_id = p_user_id;
    
    IF v_exists = 0 THEN
        SET p_success = FALSE;
        SET p_message = 'Notification not found';
    ELSE
        UPDATE Notification SET is_read = TRUE
        WHERE notification_id = p_notification_id AND user_id = p_user_id;
        
        SET p_success = TRUE;
        SET p_message = 'Notification marked as read';
    END IF;
END //

-- Procedure to get unread notification count
CREATE PROCEDURE sp_get_unread_count(
    IN p_user_id INTEGER
)
BEGIN
    SELECT COUNT(*) as unread_count FROM Notification
    WHERE user_id = p_user_id AND is_read = FALSE;
END //

-- Procedure to get notifications for a user
CREATE PROCEDURE sp_get_notifications(
    IN p_user_id INTEGER,
    IN p_limit INTEGER
)
BEGIN
    SELECT n.*, u.name as from_user_name, e.title as event_title
    FROM Notification n
    JOIN User u ON n.from_user_id = u.user_id
    LEFT JOIN Event e ON n.event_id = e.event_id
    WHERE n.user_id = p_user_id
    ORDER BY n.created_at DESC
    LIMIT p_limit;
END //

-- Function to find next available slot for a user
-- Returns the start time of the next available slot, or NULL if none found
CREATE FUNCTION find_next_available_slot(
    p_user_id INTEGER,
    p_date DATE,
    p_duration_minutes INTEGER,
    p_day_start TIME,
    p_day_end TIME,
    p_slot_minutes INTEGER
) RETURNS DATETIME
READS SQL DATA
BEGIN
    DECLARE v_current_time DATETIME;
    DECLARE v_end_time DATETIME;
    DECLARE v_slot_end DATETIME;
    DECLARE v_conflict_id INTEGER;
    DECLARE v_done BOOLEAN DEFAULT FALSE;
    
    -- Start at beginning of day
    SET v_current_time = CONCAT(DATE_FORMAT(p_date, '%Y-%m-%d'), ' ', p_day_start);
    SET v_end_time = CONCAT(DATE_FORMAT(p_date, '%Y-%m-%d'), ' ', p_day_end);
    
    -- Try each slot
    slot_loop: LOOP
        IF v_current_time >= v_end_time THEN
            RETURN NULL;  -- No available slot today
        END IF;
        
        SET v_slot_end = DATE_ADD(v_current_time, INTERVAL p_duration_minutes MINUTE);
        
        IF v_slot_end > v_end_time THEN
            RETURN NULL;  -- Event doesn't fit in remaining time
        END IF;
        
        -- Check for conflict
        SET v_conflict_id = check_user_conflict(p_user_id, v_current_time, v_slot_end, NULL);
        
        IF v_conflict_id IS NULL THEN
            -- Found available slot
            RETURN v_current_time;
        END IF;
        
        -- Move to next slot
        SET v_current_time = DATE_ADD(v_current_time, INTERVAL p_slot_minutes MINUTE);
    END LOOP slot_loop;
    
    RETURN NULL;
END //

DELIMITER ;

-- ============================================================
-- VIEWS (Common queries)
-- ============================================================

-- View: All events for a user (as creator or participant)
CREATE OR REPLACE VIEW vw_user_events AS
SELECT DISTINCT e.*, p.role AS participant_role, p.response AS participant_response
FROM Event e
LEFT JOIN Participant p ON e.event_id = p.event_id;

-- View: Scheduled events with participant count
CREATE OR REPLACE VIEW vw_scheduled_events_summary AS
SELECT e.*, 
       COUNT(p.user_id) AS participant_count,
       SUM(CASE WHEN p.response = 'accepted' THEN 1 ELSE 0 END) AS accepted_count,
       SUM(CASE WHEN p.response = 'declined' THEN 1 ELSE 0 END) AS declined_count
FROM Event e
LEFT JOIN Participant p ON e.event_id = p.event_id
WHERE e.status = 'scheduled'
GROUP BY e.event_id;

-- View: Unscheduled todos with participant count
CREATE OR REPLACE VIEW vw_unscheduled_todos AS
SELECT e.*, 
       COUNT(p.user_id) AS participant_count
FROM Event e
LEFT JOIN Participant p ON e.event_id = p.event_id
WHERE e.status = 'unscheduled'
GROUP BY e.event_id;

-- ============================================================
-- SAMPLE DATA (for testing) - Optional, skip if re-running
-- ============================================================
-- To add sample data manually, run:
-- mysql -u calendar_user -p calendar < scripts/seed_data.sql
