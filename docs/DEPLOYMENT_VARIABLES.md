# Deployment Environment Variables

## Quick Copy-Paste Guide for Render & Vercel

---

## 🚀 RENDER (Backend)

### Required Environment Variables

Copy these to Render Dashboard → Environment:

```env
# Server
NODE_ENV=production
PORT=10000

# Database (Render PostgreSQL - get this from your Render database)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long-change-this

# JWT Expiration
JWT_EXPIRE=7d

# Frontend URL (your Vercel deployment URL)
FRONTEND_URL=https://your-app-name.vercel.app

# CORS Allowed Origins (comma-separated, include your Vercel URL)
ALLOWED_ORIGINS=https://your-app-name.vercel.app

# Public Base URL (optional - used for playlist/EPG export links)
PUBLIC_BASE_URL=https://your-backend-name.onrender.com

# Stripe (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Redis (optional - Render Redis URL if using)
REDIS_URL=redis://red-xxxxx:6379
```

### Render Build & Start Commands

```
Build Command: npm install && npx prisma generate && npx prisma migrate deploy
Start Command: npm start
```

---

## ⚡ VERCEL (Frontend)

### Required Environment Variables

Copy to Vercel Dashboard → Settings → Environment Variables:

```env
# API URL (your Render backend URL)
VITE_API_URL=https://your-backend-name.onrender.com/api
```

### Vercel Build Settings

```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

---

## 📋 STEP-BY-STEP DEPLOYMENT

### Step 1: Create Render PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Name: `iptv-database`
4. Plan: Free (or Starter for production)
5. Copy the **External Database URL**

### Step 2: Deploy Backend to Render

1. Click "New +" → "Web Service"
2. Connect your GitHub repo
3. Root Directory: `backend`
4. Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
5. Start Command: `npm start`
6. Add all environment variables from above
7. Deploy!

### Step 3: Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Import your GitHub repo
3. Root Directory: `frontend`
4. Framework Preset: Vite
5. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`
6. Deploy!

### Step 4: Update CORS

After Vercel deploy, update Render's `ALLOWED_ORIGINS` and `FRONTEND_URL` with your actual Vercel URL.

---

## 🔐 GENERATING SECURE VALUES

### JWT Secret (run in terminal)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Example Output:
```
a3f2b8c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3
```

---

## 📦 RENDER.YAML (Optional - Infrastructure as Code)

Create `render.yaml` in project root for automatic setup:

```yaml
databases:
  - name: iptv-database
    plan: free
    databaseName: iptv_db
    user: iptv_user

services:
  - type: web
    name: iptv-backend
    env: node
    plan: free
    rootDir: backend
    buildCommand: npm install && npx prisma generate && npx prisma migrate deploy
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: iptv-database
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_EXPIRE
        value: 7d
      - key: FRONTEND_URL
        sync: false
      - key: ALLOWED_ORIGINS
        sync: false
      - key: STRIPE_SECRET_KEY
        sync: false
      - key: STRIPE_WEBHOOK_SECRET
        sync: false
```

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] Backend is running on Render
- [ ] Database migrations completed
- [ ] Frontend is deployed on Vercel
- [ ] CORS origins updated with actual Vercel URL
- [ ] Test login works
- [ ] Test channels load
- [ ] Configure Stripe webhooks (point to: `https://your-backend.onrender.com/api/payments/webhook`)
- [ ] Seed admin user if needed

---

## 🆘 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| CORS errors | Update `ALLOWED_ORIGINS` with exact Vercel URL |
| Database connection failed | Check `DATABASE_URL` format and credentials |
| 502 Bad Gateway | Check Render logs, ensure `PORT` is set correctly |
| API calls fail | Verify `VITE_API_URL` includes `/api` at the end |
