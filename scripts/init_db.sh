#!/bin/bash
# Database Initialization Script
# Usage: sudo ./scripts/init_db.sh
# This script uses MySQL root to set up the database, then calendar_user can use it

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-calendar}"
DB_USER="${DB_USER:-calendar_user}"
DB_PASSWORD="${DB_PASSWORD:-Calendar_Pass_2026!}"

echo "========================================"
echo "AI-Assisted Calendar - Database Setup"
echo "========================================"
echo ""

# Check if MySQL client is available
if ! command -v mysql &> /dev/null; then
    echo "ERROR: MySQL client not found. Please install mysql-client."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Step 1: Create database as root
echo "Step 1: Creating database '$DB_NAME'..."
sudo mysql -h "$DB_HOST" -P "$DB_PORT" -u root -e "
    CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
"
echo "  ✓ Database created"

# Step 2: Create user and grant privileges
echo "Step 2: Creating user '$DB_USER' and granting privileges..."
sudo mysql -h "$DB_HOST" -P "$DB_PORT" -u root -e "
    CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';
    CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
    GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'%';
    GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
    FLUSH PRIVILEGES;
"
echo "  ✓ User created and privileges granted"

# Step 3: Enable function creation
echo "Step 3: Enabling stored function creation..."
sudo mysql -h "$DB_HOST" -P "$DB_PORT" -u root -e "
    SET GLOBAL log_bin_trust_function_creators = 1;
"
echo "  ✓ Function creation enabled"

# Step 4: Run schema as root (creates tables, functions, procedures, triggers)
echo "Step 4: Running schema.sql..."
sudo mysql -h "$DB_HOST" -P "$DB_PORT" -u root "$DB_NAME" < "$SCRIPT_DIR/schema.sql"
echo "  ✓ Schema installed"

# Step 5: Verify installation
echo "Step 5: Verifying installation..."
TABLE_COUNT=$(sudo mysql -h "$DB_HOST" -P "$DB_PORT" -u root "$DB_NAME" -N -e "
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = '$DB_NAME' AND table_type = 'BASE TABLE';
")

FUNC_COUNT=$(sudo mysql -h "$DB_HOST" -P "$DB_PORT" -u root "$DB_NAME" -N -e "
    SELECT COUNT(*) FROM information_schema.routines 
    WHERE routine_schema = '$DB_NAME' AND routine_type = 'FUNCTION';
")

PROC_COUNT=$(sudo mysql -h "$DB_HOST" -P "$DB_PORT" -u root "$DB_NAME" -N -e "
    SELECT COUNT(*) FROM information_schema.routines 
    WHERE routine_schema = '$DB_NAME' AND routine_type = 'PROCEDURE';
")

echo "  ✓ Tables: $TABLE_COUNT"
echo "  ✓ Functions: $FUNC_COUNT"
echo "  ✓ Procedures: $PROC_COUNT"

echo ""
echo "========================================"
echo "Database setup completed!"
echo "========================================"
echo ""
echo "Connection details:"
echo "  Host:     $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User:     $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo "Test connection:"
echo "  mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME"
echo ""
echo "Next steps:"
echo "  1. Copy backend/.env.example to backend/.env"
echo "  2. Update DB_USER, DB_PASSWORD in .env"
echo "  3. Add your OpenAI API key to .env"
echo "  4. Run: cd backend && pip install -r requirements.txt"
echo ""
