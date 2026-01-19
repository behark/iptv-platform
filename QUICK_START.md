# Quick Start Guide

Follow these steps to get your IPTV platform running!

## Step 1: Start PostgreSQL

```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Verify it's running
sudo systemctl status postgresql
```

## Step 2: Create Database

You have two options:

### Option A: Use the setup script (Recommended)
```bash
cd /home/behar/iptv-platform
./setup-database.sh
```

### Option B: Manual setup
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Run these commands:
CREATE DATABASE iptv_db;
CREATE USER iptv_user WITH PASSWORD 'iptv_password_123';
ALTER USER iptv_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE iptv_db TO iptv_user;
\q
```

## Step 3: Update Database URL (if needed)

If you used a different password or database name, update `backend/.env`:

```bash
nano backend/.env
# Update DATABASE_URL with your credentials
```

## Step 4: Run Database Migrations

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

When prompted for a migration name, just press Enter or type "init".

## Step 5: Seed Database (Optional but Recommended)

This creates sample admin and user accounts:

```bash
cd backend
npm run seed
```

**Default credentials:**
- Admin: `admin@iptv.com` / `admin123`
- User: `user@iptv.com` / `user123`

## Step 6: Start Backend Server

```bash
cd backend
npm run dev
```

The backend will run on `http://localhost:5000`

## Step 7: Start Frontend (New Terminal)

Open a new terminal:

```bash
cd /home/behar/iptv-platform/frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

## Step 8: Access the Platform

1. Open your browser: `http://localhost:3000`
2. Login with: `admin@iptv.com` / `admin123`
3. Or register a new account

## Troubleshooting

### PostgreSQL not starting?
```bash
# Check status
sudo systemctl status postgresql

# Check logs
sudo journalctl -u postgresql

# Try starting manually
sudo systemctl start postgresql
```

### Database connection error?
- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `backend/.env`
- Ensure database and user exist

### Port already in use?
- Backend (5000): Change `PORT` in `backend/.env`
- Frontend (3000): Change port in `frontend/vite.config.js`

### Migration errors?
```bash
cd backend
npx prisma migrate reset  # WARNING: This deletes all data!
npx prisma migrate dev
```

## Next Steps

1. **Add Content**: Use the API or create an admin interface to add channels/videos
2. **Configure Stripe**: Add your Stripe keys for payment processing
3. **Customize**: Update branding, colors, and content
4. **Deploy**: Follow production deployment guide in SETUP.md

## Need Help?

- Check `SETUP.md` for detailed instructions
- Check `ARCHITECTURE.md` for system overview
- Review error messages in terminal

Enjoy your IPTV platform! 🎉
