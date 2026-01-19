# Fix PostgreSQL Connection Issue

## Problem
PostgreSQL service shows as "active" but the server isn't actually running.

## Solution

### Step 1: Find Your PostgreSQL Cluster

Run this to see available PostgreSQL services:
```bash
sudo systemctl list-units | grep postgresql
```

### Step 2: Start the Correct Service

Based on what you see, try one of these:

```bash
# Most common options:
sudo systemctl start postgresql@main
sudo systemctl start postgresql@14-main
sudo systemctl start postgresql@15-main
sudo systemctl start postgresql@16-main

# Or try:
sudo service postgresql start
```

### Step 3: Verify It's Running

```bash
pg_isready -h localhost -p 5432
```

You should see: `localhost:5432 - accepting connections`

### Step 4: Run the Launch Script

Once PostgreSQL is running:
```bash
cd /home/behar/iptv-platform
./auto-launch.sh
```

## Alternative: Use the Helper Script

```bash
./start-postgresql.sh
```

This will try to automatically find and start your PostgreSQL cluster.

## Still Having Issues?

Check PostgreSQL logs:
```bash
sudo journalctl -u postgresql@main -n 50
# Or
sudo journalctl -u postgresql@14-main -n 50
```
