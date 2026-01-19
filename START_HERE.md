# 🚀 START HERE - Launch Instructions

## Quick Launch (3 Steps)

### Step 1: Start PostgreSQL
Open a terminal and run:
```bash
sudo systemctl start postgresql
```

### Step 2: Run the Launch Script
```bash
cd /home/behar/iptv-platform
./launch.sh
```

### Step 3: Open Your Browser
Go to: **http://localhost:3000**

Login with:
- Email: `admin@iptv.com`
- Password: `admin123`

---

## Manual Launch (If Script Doesn't Work)

### 1. Start PostgreSQL
```bash
sudo systemctl start postgresql
```

### 2. Create Database
```bash
sudo -u postgres psql
```
Then run:
```sql
CREATE DATABASE iptv_db;
CREATE USER iptv_user WITH PASSWORD 'iptv_password_123';
ALTER USER iptv_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE iptv_db TO iptv_user;
\q
```

### 3. Run Migrations
```bash
cd /home/behar/iptv-platform/backend
npx prisma migrate dev
```
(Press Enter when asked for migration name)

### 4. Seed Database
```bash
npm run seed
```

### 5. Start Backend (Terminal 1)
```bash
cd /home/behar/iptv-platform/backend
npm run dev
```

### 6. Start Frontend (Terminal 2)
```bash
cd /home/behar/iptv-platform/frontend
npm run dev
```

### 7. Access Platform
Open: http://localhost:3000

---

That's it! 🎉
