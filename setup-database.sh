#!/bin/bash

# IPTV Platform Database Setup Script

echo "🚀 IPTV Platform Database Setup"
echo "================================"
echo ""

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "⚠️  PostgreSQL is not running!"
    echo ""
    echo "Please start PostgreSQL first:"
    echo "  sudo systemctl start postgresql"
    echo "  # OR"
    echo "  sudo service postgresql start"
    echo ""
    read -p "Press Enter after starting PostgreSQL, or Ctrl+C to exit..."
fi

# Get database credentials
echo "Enter PostgreSQL superuser (default: postgres):"
read -r DB_USER
DB_USER=${DB_USER:-postgres}

echo "Enter database name (default: iptv_db):"
read -r DB_NAME
DB_NAME=${DB_NAME:-iptv_db}

echo "Enter database password (leave empty if using peer authentication):"
read -rs DB_PASSWORD

# Create database
echo ""
echo "Creating database '$DB_NAME'..."

if [ -z "$DB_PASSWORD" ]; then
    # Using peer authentication (no password)
    sudo -u postgres psql <<EOF
CREATE DATABASE $DB_NAME;
CREATE USER iptv_user WITH PASSWORD 'iptv_password_123';
ALTER USER iptv_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO iptv_user;
\q
EOF
    DB_URL="postgresql://iptv_user:iptv_password_123@localhost:5432/$DB_NAME?schema=public"
else
    # Using password authentication
    PGPASSWORD=$DB_PASSWORD psql -U "$DB_USER" -h localhost <<EOF
CREATE DATABASE $DB_NAME;
CREATE USER iptv_user WITH PASSWORD 'iptv_password_123';
ALTER USER iptv_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO iptv_user;
\q
EOF
    DB_URL="postgresql://iptv_user:iptv_password_123@localhost:5432/$DB_NAME?schema=public"
fi

if [ $? -eq 0 ]; then
    echo "✅ Database created successfully!"
    echo ""
    echo "📝 Update your backend/.env file with:"
    echo "DATABASE_URL=\"$DB_URL\""
    echo ""
    echo "You can now run:"
    echo "  cd backend"
    echo "  npx prisma migrate dev"
    echo "  npm run seed"
else
    echo "❌ Database creation failed!"
    exit 1
fi
