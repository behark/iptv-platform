# Setup Status

## ✅ Completed

1. **Dependencies Installed**
   - ✅ Backend packages installed
   - ✅ Frontend packages installed
   - ✅ Prisma client generated

2. **Configuration Files**
   - ✅ Backend `.env` created with secure JWT secret
   - ✅ Frontend `.env` created
   - ✅ Database URL configured (default: iptv_db)

3. **Project Structure**
   - ✅ All backend routes created
   - ✅ All frontend pages created
   - ✅ Video player component ready
   - ✅ Authentication system ready

## 📋 Next Steps (You Need to Do)

### 1. Start PostgreSQL ⚠️ REQUIRES SUDO

```bash
sudo systemctl start postgresql
```

Verify it's running:
```bash
sudo systemctl status postgresql
```

### 2. Create Database

**Option A - Automated (Recommended):**
```bash
cd /home/behar/iptv-platform
./setup-database.sh
```

**Option B - Manual:**
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

When prompted for migration name, press Enter or type "init".

### 4. Seed Database (Optional)

```bash
cd /home/behar/iptv-platform/backend
npm run seed
```

This creates:
- Admin: `admin@iptv.com` / `admin123`
- User: `user@iptv.com` / `user123`

### 5. Start the Platform

**Terminal 1 - Backend:**
```bash
cd /home/behar/iptv-platform/backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd /home/behar/iptv-platform/frontend
npm run dev
```

**OR use the startup script:**
```bash
cd /home/behar/iptv-platform
./start.sh
```

### 6. Access the Platform

Open your browser: **http://localhost:3000**

Login with:
- Email: `admin@iptv.com`
- Password: `admin123`

## 📁 Important Files

- **Setup Instructions**: `SETUP_INSTRUCTIONS.txt`
- **Quick Start Guide**: `QUICK_START.md`
- **Detailed Setup**: `SETUP.md`
- **Architecture**: `ARCHITECTURE.md`

## 🔧 Configuration

### Backend (.env)
- ✅ JWT_SECRET: Generated and configured
- ✅ DATABASE_URL: Ready (update if you changed credentials)
- ⚠️ STRIPE_SECRET_KEY: Add your Stripe key for payments
- ⚠️ STRIPE_WEBHOOK_SECRET: Add your Stripe webhook secret

### Frontend (.env)
- ✅ VITE_API_URL: Configured to http://localhost:5000/api
- ⚠️ VITE_STRIPE_PUBLISHABLE_KEY: Add your Stripe publishable key

## 🎯 What's Ready

- ✅ User registration and login
- ✅ JWT authentication
- ✅ Channel management API
- ✅ Video management API
- ✅ Subscription system
- ✅ Payment integration (Stripe)
- ✅ Video player (HLS.js)
- ✅ EPG support
- ✅ Watch history
- ✅ Favorites system

## ⚠️ Before Going Live

1. Change default admin password
2. Add your Stripe keys
3. Add your licensed content
4. Configure production environment variables
5. Set up HTTPS
6. Configure proper CORS origins
7. Set up database backups
8. Review security settings

## 🆘 Troubleshooting

**PostgreSQL won't start?**
```bash
sudo journalctl -u postgresql
```

**Database connection error?**
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in `backend/.env`
- Ensure database exists

**Port already in use?**
- Backend: Change `PORT` in `backend/.env`
- Frontend: Change port in `frontend/vite.config.js`

**Migration errors?**
```bash
cd backend
npx prisma migrate reset  # WARNING: Deletes data!
npx prisma migrate dev
```

---

**You're almost there!** Just start PostgreSQL and run the migrations. 🚀
