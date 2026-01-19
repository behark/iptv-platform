# Legal IPTV Platform

A full-featured, legal IPTV (Internet Protocol Television) platform built with modern technologies.

## Features

- 🎬 **Video Streaming**: HLS/DASH support with adaptive bitrate streaming
- 👥 **User Management**: Registration, authentication, profiles
- 💳 **Subscription System**: Multiple subscription tiers and payment integration
- 📺 **Content Management**: Admin dashboard for managing channels, videos, and playlists
- 📱 **Responsive Design**: Works on web, mobile, and TV devices
- 🔐 **Secure**: JWT authentication, role-based access control
- 📊 **Analytics**: View tracking and user analytics
- 📅 **EPG Support**: Electronic Program Guide integration
- 🎨 **Modern UI**: Beautiful, intuitive user interface

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL (with Prisma ORM)
- JWT Authentication
- Stripe for payments
- Redis for caching

### Frontend
- React + TypeScript
- HLS.js for video streaming
- Tailwind CSS for styling
- React Router for navigation

## Project Structure

```
iptv-platform/
├── backend/          # Node.js API server
├── frontend/         # React web application
├── admin/            # Admin dashboard
└── docs/             # Documentation
```

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

### Quick Setup

1. **Install dependencies:**
   ```bash
   # Backend
   cd backend && npm install
   
   # Frontend
   cd frontend && npm install
   ```

2. **Set up database:**
   ```bash
   # Create PostgreSQL database
   createdb iptv_db
   
   # Run migrations
   cd backend
   npx prisma generate
   npx prisma migrate dev
   npm run seed  # Optional: seed with sample data
   ```

3. **Configure environment:**
   - Copy `.env.example` to `.env` in both `backend/` and `frontend/`
   - Update with your database credentials and Stripe keys

4. **Start servers:**
   ```bash
   # Backend (Terminal 1)
   cd backend && npm run dev
   
   # Frontend (Terminal 2)
   cd frontend && npm run dev
   ```

5. **Access the platform:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Default admin: admin@iptv.com / admin123

## Environment Variables

See `.env.example` files in each directory for required environment variables.

**Backend (.env):**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

**Frontend (.env):**
- `VITE_API_URL` - Backend API URL
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

## License

This platform is designed for legal content distribution only. Ensure you have proper licensing for all content.
