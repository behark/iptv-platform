#!/bin/bash

echo "🔍 Finding PostgreSQL installation..."

# Check which PostgreSQL version/cluster is available
if systemctl list-units | grep -q "postgresql@"; then
    echo "Found PostgreSQL systemd services:"
    systemctl list-units | grep postgresql@ | head -3
    
    echo ""
    echo "Trying to start PostgreSQL cluster..."
    
    # Try common cluster names
    for cluster in main 14-main 15-main 16-main; do
        if systemctl start postgresql@$cluster 2>/dev/null; then
            echo "✅ Started postgresql@$cluster"
            sleep 2
            if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
                echo "✅ PostgreSQL is now running!"
                exit 0
            fi
        fi
    done
fi

# Alternative: try service command
if service postgresql start 2>/dev/null; then
    echo "✅ Started via service command"
    sleep 2
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "✅ PostgreSQL is now running!"
        exit 0
    fi
fi

echo ""
echo "⚠️  Could not start PostgreSQL automatically"
echo ""
echo "Please try one of these commands manually:"
echo "  sudo systemctl start postgresql@main"
echo "  sudo systemctl start postgresql@14-main"
echo "  sudo systemctl start postgresql@15-main"
echo "  sudo systemctl start postgresql@16-main"
echo "  sudo service postgresql start"
echo ""
echo "To find your PostgreSQL version:"
echo "  sudo systemctl list-units | grep postgresql"
