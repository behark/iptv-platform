#!/bin/bash

echo "🔧 Creating Database User"
echo "========================"
echo ""

# Create database and user
sudo -u postgres psql <<EOF
-- Create database if it doesn't exist
SELECT 'CREATE DATABASE iptv_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'iptv_db')\gexec

-- Create user if it doesn't exist
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'iptv_user') THEN
      CREATE USER iptv_user WITH PASSWORD 'iptv_password_123';
   END IF;
END
\$\$;

-- Grant privileges
ALTER USER iptv_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE iptv_db TO iptv_user;

-- Connect to iptv_db and grant schema privileges
\c iptv_db
GRANT ALL ON SCHEMA public TO iptv_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO iptv_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO iptv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO iptv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO iptv_user;

\q
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database and user created successfully!"
    echo ""
    echo "You can now run: ./auto-launch.sh"
else
    echo "❌ Failed to create database user"
    exit 1
fi
