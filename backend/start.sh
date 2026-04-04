#!/bin/bash
# Backend Start Script
# Usage: ./backend/start.sh

set -e

cd "$(dirname "$0")"

echo "========================================"
echo "AI-Assisted Calendar - Backend Server"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "WARNING: .env file not found!"
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo ""
    echo "Please edit .env with your configuration before starting."
    echo "Required settings:"
    echo "  - DB_PASSWORD"
    echo "  - JWT_SECRET_KEY"
    echo "  - OPENAI_API_KEY"
    echo ""
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "Installing dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo ""
echo "Starting FastAPI server..."
echo "API docs available at: http://localhost:8000/docs"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
