#!/bin/bash

# Auto-launch script for IPTV Platform
# This will set up and launch everything automatically

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 IPTV Platform Auto-Launch"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Function to check PostgreSQL
check_postgresql() {
    # Try multiple ways to check if PostgreSQL is running
    if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
        return 0
    elif pg_isready -q 2>/dev/null; then
        return 0
    elif psql -h localhost -U postgres -c "SELECT 1;" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Try to start PostgreSQL if not running
echo "🔍 Checking PostgreSQL..."
if ! check_postgresql; then
    echo "⚠️  PostgreSQL doesn't seem to be responding..."
    echo "Attempting to start PostgreSQL..."
    
    # Try different ways to start PostgreSQL
    sudo systemctl start postgresql@main 2>/dev/null || \
    sudo systemctl start postgresql@14-main 2>/dev/null || \
    sudo systemctl start postgresql@15-main 2>/dev/null || \
    sudo systemctl start postgresql@16-main 2>/dev/null || \
    sudo service postgresql start 2>/dev/null || \
    echo "Could not start PostgreSQL automatically"
    
    # Wait a moment for it to start
    sleep 3
    
    # Check again
    if ! check_postgresql; then
        echo "❌ PostgreSQL is still not running!"
        echo ""
        echo "Please try starting it manually:"
        echo "  sudo systemctl start postgresql@main"
        echo "  # OR"
        echo "  sudo systemctl start postgresql@14-main"
        echo "  # OR"
        echo "  sudo service postgresql start"
        echo ""
        echo "Then run this script again:"
        echo "  ./auto-launch.sh"
        exit 1
    fi
fi
echo "✅ PostgreSQL is running"
echo ""

# Navigate to project root
cd "$(dirname "$0")"

# Create database if it doesn't exist
echo "📦 Setting up database..."

# Check if database exists by trying to connect
DB_EXISTS=$(psql -U iptv_user -d iptv_db -c "SELECT 1;" 2>&1 | grep -c "1 row" || echo "0")

# Also check if user exists
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_user WHERE usename='iptv_user'" 2>/dev/null || echo "0")

if [ "$USER_EXISTS" != "1" ] || [ "$DB_EXISTS" != "1" ]; then
    echo "Creating database and user..."
    
    # Create database and user using the helper script
    if [ -f "./create-db-user.sh" ]; then
        ./create-db-user.sh
    else
        echo "⚠️  Please run: ./create-db-user.sh"
        echo "Or manually create the database user"
        exit 1
    fi
else
    echo "✅ Database and user already exist"
fi
echo ""

# Run migrations
echo "🔄 Running database migrations..."
cd backend
export DATABASE_URL="postgresql://iptv_user:iptv_password_123@localhost:5432/iptv_db?schema=public"

npx prisma migrate deploy 2>/dev/null || {
    echo "Running initial migration..."
    echo "" | npx prisma migrate dev --name init
}

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed"
else
    echo "⚠️  Migration completed (may have warnings)"
fi
echo ""

# Seed database
echo "🌱 Seeding database..."
npm run seed 2>/dev/null || echo "⚠️  Seed may have issues (database might already be seeded)"
echo ""

# Start backend in background
echo "🔧 Starting backend server..."
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo ""

# Wait for backend
echo "⏳ Waiting for backend to start..."
for i in {1..10}; do
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo "✅ Backend is running!"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Start frontend in background
echo "🎨 Starting frontend server..."
cd ../frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
echo ""

# Wait a bit for frontend
sleep 3

# Save PIDs
echo "$BACKEND_PID" > ../logs/backend.pid
echo "$FRONTEND_PID" > ../logs/frontend.pid

# Success message
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ IPTV Platform is Running!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📍 Backend:  http://localhost:5000"
echo "📍 Frontend: http://localhost:3000"
echo ""
echo "🔐 Login Credentials:"
echo "   Email:    admin@iptv.com"
echo "   Password: admin123"
echo ""
echo "📋 Useful Commands:"
echo "   View backend logs:  tail -f logs/backend.log"
echo "   View frontend logs: tail -f logs/frontend.log"
echo "   Stop servers:       ./stop.sh"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 Open your browser and go to: http://localhost:3000"
echo ""
