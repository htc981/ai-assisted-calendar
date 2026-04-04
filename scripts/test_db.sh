#!/bin/bash
# Database Test Runner
# Usage: ./scripts/test_db.sh

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-calendar}"
DB_USER="${DB_USER:-calendar_user}"

echo "========================================"
echo "AI-Assisted Calendar - Database Tests"
echo "========================================"
echo ""
echo "Database: $DB_NAME @ $DB_HOST:$DB_PORT"
echo ""

# Check if MySQL client is available
if ! command -v mysql &> /dev/null; then
    echo "ERROR: MySQL client not found. Please install mysql-client."
    exit 1
fi

# Run tests
echo "Running test cases..."
echo ""

mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < scripts/test_db_cases.sql

echo ""
echo "========================================"
echo "Tests completed!"
echo "========================================"
