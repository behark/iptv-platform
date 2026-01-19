# IPTV Platform Setup Guide

Complete setup instructions for the Legal IPTV Platform.

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+
- **Redis** (optional, for caching)
- **Stripe Account** (for payments)

## Step 1: Database Setup

### Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### Create Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE iptv_db;
CREATE USER iptv_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE iptv_db TO iptv_user;
\q
```

## Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env file with your settings:
# - DATABASE_URL: postgresql://iptv_user:your_password@localhost:5432/iptv_db
# - JWT_SECRET: Generate a random secret key
# - STRIPE_SECRET_KEY: Your Stripe secret key
# - STRIPE_WEBHOOK_SECRET: Your Stripe webhook secret

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npm run seed

# Start development server
npm run dev
```

The backend will run on `http://localhost:5000`

## Step 3: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env file:
# - VITE_API_URL: http://localhost:5000/api
# - VITE_STRIPE_PUBLISHABLE_KEY: Your Stripe publishable key

# Start development server
npm run dev
```

The frontend will run on `http://localhost:3000`

## Step 4: Stripe Configuration

1. **Create Stripe Account**: https://stripe.com
2. **Get API Keys**: Dashboard → Developers → API keys
3. **Set up Webhook**:
   - Go to Developers → Webhooks
   - Add endpoint: `http://localhost:5000/api/payments/webhook`
   - Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy webhook signing secret to `.env`

## Step 5: Adding Content

### Using Admin Account

Default admin credentials (from seed):
- Email: `admin@iptv.com`
- Password: `admin123`

### Add Channels via API

```bash
# Login to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@iptv.com","password":"admin123"}'

# Use the token to create a channel
curl -X POST http://localhost:5000/api/channels \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Channel",
    "description": "Channel description",
    "streamUrl": "https://example.com/stream.m3u8",
    "streamType": "HLS",
    "category": "News",
    "language": "en",
    "country": "US"
  }'
```

### Add Videos via Database

You can add videos directly to the database or create an admin interface.

## Step 6: Testing

1. **Register a new user** at `http://localhost:3000/register`
2. **Login** at `http://localhost:3000/login`
3. **Subscribe to a plan** at `http://localhost:3000/plans`
4. **Browse channels** at `http://localhost:3000/channels`
5. **Watch content** by clicking on channels/videos

## Production Deployment

### Backend

1. Set `NODE_ENV=production` in `.env`
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name iptv-backend
   ```

### Frontend

1. Build the frontend:
   ```bash
   npm run build
   ```
2. Serve with nginx or similar:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           root /path/to/frontend/dist;
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify DATABASE_URL in `.env`
- Check firewall settings

### CORS Issues
- Update `ALLOWED_ORIGINS` in backend `.env`
- Ensure frontend URL matches

### Video Playback Issues
- Verify stream URLs are accessible
- Check HLS.js compatibility
- Test stream URLs directly in browser

### Payment Issues
- Verify Stripe keys are correct
- Check webhook endpoint is accessible
- Review Stripe dashboard for errors

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS in production
- [ ] Set secure CORS origins
- [ ] Use environment variables for secrets
- [ ] Enable rate limiting
- [ ] Regular database backups
- [ ] Keep dependencies updated

## Support

For issues or questions, check the main README.md or create an issue in the repository.
