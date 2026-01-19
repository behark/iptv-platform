# Fix PostgreSQL - Initialize Cluster

## Problem
PostgreSQL 16 is installed but no cluster is initialized, causing "Assertion failed" errors.

## Solution

### Step 1: Check Existing Clusters

```bash
sudo pg_lsclusters
```

If it shows "No clusters found" or empty, you need to create one.

### Step 2: Create PostgreSQL Cluster

```bash
sudo pg_createcluster 16 main
```

This creates a cluster named "main" for PostgreSQL 16.

### Step 3: Start the Cluster

```bash
sudo systemctl start postgresql@16-main
```

### Step 4: Verify It's Running

```bash
pg_isready -h localhost -p 5432
```

You should see: `localhost:5432 - accepting connections`

### Step 5: Launch the Platform

```bash
cd /home/behar/iptv-platform
./auto-launch.sh
```

## Or Use the Helper Script

I've created a script that does this automatically:

```bash
cd /home/behar/iptv-platform
./init-postgresql.sh
```

Then:
```bash
./auto-launch.sh
```

## Alternative: Use SQLite (Quick Test)

If you just want to test the platform quickly, we can temporarily use SQLite instead of PostgreSQL. Let me know if you want this option.
