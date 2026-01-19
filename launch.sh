#!/bin/bash

echo "🚀 Launching IPTV Platform..."
echo ""

# Check PostgreSQL
if ! pg_isready -q 2>/dev/null; then
    echo "⚠️  PostgreSQL is not running!"
    echo ""
    echo "Please start PostgreSQL first by running:"
    echo "  sudo systemctl start postgresql"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ PostgreSQL is running"
echo ""

# Check if database exists, if not create it
DB_EXISTS=$(psql -U iptv_user -d iptv_db -c "SELECT 1;" 2>&1 | grep -c "1 row" || echo "0")

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "📦 Creating database..."
    
    # Try to create database (may need sudo)
    sudo -u postgres psql <<EOF 2>/dev/null || echo "Database creation may need manual setup"
CREATE DATABASE iptv_db;
CREATE USER iptv_user WITH PASSWORD 'iptv_password_123';
ALTER USER iptv_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE iptv_db TO iptv_user;
\q
EOF
    
    if [ $? -eq 0 ]; then
        echo "✅ Database created"
    else
        echo "⚠️  Could not create database automatically"
        echo "Please run: ./setup-database.sh"
        exit 1
    fi
else
    echo "✅ Database exists"
fi

echo ""

# Run migrations
echo "🔄 Running database migrations..."
cd backend
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init <<< ""
if [ $? -eq 0 ]; then
    echo "✅ Migrations completed"
else
    echo "⚠️  Migration may have issues, but continuing..."
fi

echo ""

# Seed database (optional, won't fail if already seeded)
echo "🌱 Seeding database..."
npm run seed 2>/dev/null || echo "Database may already be seeded"
echo ""

# Start backend
echo "🔧 Starting backend server..."
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
echo "Backend logs: tail -f backend.log"
echo ""

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend is running on http://localhost:5000"
else
    echo "⚠️  Backend may still be starting..."
fi

echo ""

# Start frontend
echo "🎨 Starting frontend server..."
cd ../frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"
echo "Frontend logs: tail -f frontend.log"
echo ""

# Wait a bit
sleep 3

echo "═══════════════════════════════════════════════════════════"
echo "  ✅ IPTV Platform is launching!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📍 Backend:  http://localhost:5000"
echo "📍 Frontend: http://localhost:3000"
echo ""
echo "Default Login:"
echo "  Email:    admin@iptv.com"
echo "  Password: admin123"
echo ""
echo "To stop the servers:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Or check logs:"
echo "  tail -f backend.log"
echo "  tail -f frontend.log"
echo ""
echo "═══════════════════════════════════════════════════════════"
