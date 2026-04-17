#!/bin/bash
# Backend API Test Script - Simple and Direct

BASE_URL="http://localhost:8000"
TEST_TOKEN=""

echo "=== Logging in... ==="
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}')

if ! echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
  echo "Login failed"
  exit 1
fi

TEST_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
echo "Token obtained"

# ============================================================
# Manual Tests - Copy these commands to run individually
# ============================================================

echo ""
echo "========================================"
echo "Manual Test Commands (copy and run):"
echo "========================================"
echo ""

echo "# 1. Create unscheduled todo"
echo "curl -s -X POST '${BASE_URL}/api/events' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"title\": \"Test Todo\", \"priority\": 3}'"
echo ""

echo "# 2. Create scheduled event"
echo "curl -s -X POST '${BASE_URL}/api/events' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"title\": \"Scheduled\", \"priority\": 2, \"start_time\": \"2026-04-15 10:00:00\", \"end_time\": \"2026-04-15 11:00:00\", \"status\": \"scheduled\"}'"
echo ""

echo "# 3. Get event by ID (replaceEventId with actual ID)"
echo "curl -s -X GET '${BASE_URL}/api/events/<EventId>' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}'"
echo ""

echo "# 4. Edit event title"
echo "curl -s -X PUT '${BASE_URL}/api/events/<EventId>' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"title\": \"Updated Title\"}'"
echo ""

echo "# 5. Invalid time range"
echo "curl -s -X PUT '${BASE_URL}/api/events/<EventId>' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"start_time\": \"2026-04-15 11:00:00\", \"end_time\": \"2026-04-15 10:00:00\"}'"
echo ""

echo "# 6. Schedule unscheduled todo"
echo "curl -s -X POST '${BASE_URL}/api/events/<TodoId>/schedule' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"start_time\": \"2026-04-15 14:00:00\", \"end_time\": \"2026-04-15 14:30:00\"}'"
echo ""

echo "# 7. Cancel event"
echo "curl -s -X POST '${BASE_URL}/api/events/<EventId>/cancel' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}'"
echo ""

echo "# 8. Unschedule event"
echo "curl -s -X PUT '${BASE_URL}/api/events/<EventId>' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"start_time\": null, \"end_time\": null, \"status\": \"unscheduled\"}'"
echo ""

echo "# 9. Delete event"
echo "curl -s -X DELETE '${BASE_URL}/api/events/<EventId>' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}'"
echo ""

echo "# 10. Add participant"
echo "curl -s -X POST '${BASE_URL}/api/events/<EventId>/participants' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"user_id\": 1, \"role\": \"required\"}'"
echo ""

echo "# 11. Duplicate participant test"
echo "# Run the above command again with same data"
echo ""

echo "# 12. Update participant response"
echo "curl -s -X PUT '${BASE_URL}/api/events/<EventId>/participants/1/response' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"response\": \"accepted\"}'"
echo ""

echo "# 13. Remove participant"
echo "curl -s -X DELETE '${BASE_URL}/api/events/<EventId>/participants/1' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}'"
echo ""

echo "# 14. Priority - Create high priority over low priority"
echo "curl -s -X POST '${BASE_URL}/api/events' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"title\": \"High Priority\", \"priority\": 1, \"start_time\": \"2026-04-16 10:00:00\", \"end_time\": \"2026-04-16 11:00:00\"}'"
echo ""

echo "# 15. Auto-schedule"
echo "curl -s -X POST '${BASE_URL}/api/ai/schedule' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"event_ids\": [1,2], \"range_start\": \"2026-04-15T09:00:00\", \"range_end\": \"2026-04-15T18:00:00\"}'"
echo ""

echo "# 16. NL Parse"
echo "curl -s -X POST '${BASE_URL}/api/ai/parse' \\"
echo "  -H 'Authorization: Bearer ${TEST_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"text\": \"Team meeting tomorrow at 2pm\"}'"
echo ""

echo "========================================"
echo "Tests complete - copy and run commands"
echo "========================================"
