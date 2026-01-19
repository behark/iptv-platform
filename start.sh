#!/bin/bash

# IPTV Platform Startup Script

echo "🚀 Starting IPTV Platform..."
echo ""

# Check PostgreSQL
if ! pg_isready -q; then
    echo "⚠️  PostgreSQL is not running!"
    echo "Please start it first:"
    echo "  sudo systemctl start postgresql"
    echo ""
    exit 1
fi

# Check if database exists
DB_EXISTS=$(psql -U iptv_user -d iptv_db -c "SELECT 1;" 2>&1 | grep -c "1 row")

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "📦 Database not found. Setting up..."
    echo ""
    echo "Please run the database setup first:"
    echo "  ./setup-database.sh"
    echo ""
    echo "Or manually create the database (see QUICK_START.md)"
    exit 1
fi

# Start backend
echo "🔧 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
echo ""

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"
echo ""

echo "✅ Platform is starting!"
echo ""
echo "📍 Backend:  http://localhost:5000"
echo "📍 Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
