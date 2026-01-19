#!/bin/bash

echo "🔧 PostgreSQL Cluster Initialization"
echo "====================================="
echo ""

# Check if cluster exists
echo "Checking for existing PostgreSQL clusters..."
sudo pg_lsclusters 2>&1

echo ""
echo "If you see 'No clusters found', you need to create one."
echo ""

# Try to create a cluster
echo "Attempting to create PostgreSQL cluster 'main'..."
echo ""

sudo pg_createcluster 16 main 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Cluster created successfully!"
    echo ""
    echo "Starting the cluster..."
    sudo systemctl start postgresql@16-main
    
    sleep 2
    
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "✅ PostgreSQL is now running!"
        echo ""
        echo "You can now run: ./auto-launch.sh"
    else
        echo "⚠️  Cluster created but not responding yet"
        echo "Try: sudo systemctl start postgresql@16-main"
    fi
else
    echo ""
    echo "⚠️  Could not create cluster automatically"
    echo ""
    echo "Please run these commands manually:"
    echo "  sudo pg_createcluster 16 main"
    echo "  sudo systemctl start postgresql@16-main"
    echo "  pg_isready -h localhost -p 5432"
    echo ""
    echo "Then run: ./auto-launch.sh"
fi
