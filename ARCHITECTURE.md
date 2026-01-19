# IPTV Platform Architecture

## Overview

This is a full-stack legal IPTV platform built with modern technologies, designed for legal content distribution.

## System Architecture

```
┌─────────────┐
│   Client    │ (React Frontend)
│  (Browser)  │
└──────┬──────┘
       │ HTTP/HTTPS
       │
┌──────▼─────────────────────────────────┐
│         Backend API (Express)          │
│  ┌──────────────────────────────────┐  │
│  │  Authentication & Authorization   │  │
│  │  - JWT Tokens                     │  │
│  │  - Role-based Access Control      │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  Business Logic                  │  │
│  │  - User Management               │  │
│  │  - Subscription Management       │  │
│  │  - Content Management            │  │
│  │  - Payment Processing            │  │
│  └──────────────────────────────────┘  │
└──────┬─────────────────────────────────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
│ PostgreSQL  │ │   Redis   │ │  Stripe   │
│  Database   │ │  (Cache)  │ │ Payments  │
└─────────────┘ └───────────┘ └───────────┘
       │
       │
┌──────▼─────────────────────────────────┐
│      Content Delivery Network (CDN)    │
│      - Video Streaming Servers           │
│      - HLS/DASH Streams                 │
└─────────────────────────────────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Payments**: Stripe
- **Caching**: Redis (optional)
- **Security**: Helmet, CORS, Rate Limiting

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Video Player**: HLS.js
- **HTTP Client**: Axios
- **Routing**: React Router
- **State Management**: React Context API

## Database Schema

### Core Models

1. **User**: User accounts and authentication
2. **Subscription**: User subscription management
3. **Plan**: Subscription plans and pricing
4. **Channel**: Live TV channels
5. **Video**: Video on Demand (VOD) content
6. **Playlist**: Collections of channels/videos
7. **ChannelAccess**: Plan-to-channel access mapping
8. **WatchHistory**: User viewing history
9. **Favorite**: User favorites
10. **EPGEntry**: Electronic Program Guide data

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Channels
- `GET /api/channels` - List channels (requires subscription)
- `GET /api/channels/:id` - Get channel details
- `POST /api/channels` - Create channel (admin)
- `PUT /api/channels/:id` - Update channel (admin)
- `DELETE /api/channels/:id` - Delete channel (admin)

### Videos
- `GET /api/videos` - List videos (requires subscription)
- `GET /api/videos/:id` - Get video details

### Subscriptions
- `GET /api/subscriptions/plans` - List subscription plans
- `GET /api/subscriptions/my-subscription` - Get user subscription

### Payments
- `POST /api/payments/create-checkout` - Create Stripe checkout
- `POST /api/payments/webhook` - Stripe webhook handler

### EPG
- `GET /api/epg/:channelId` - Get EPG for channel

## Security Features

1. **Authentication**: JWT-based token authentication
2. **Authorization**: Role-based access control (USER, ADMIN, MODERATOR)
3. **Subscription Gating**: Content access requires active subscription
4. **Rate Limiting**: Prevents API abuse
5. **CORS**: Configured for allowed origins
6. **Helmet**: Security headers
7. **Input Validation**: Express-validator for request validation
8. **Password Hashing**: bcryptjs for secure password storage

## Content Delivery

### Supported Formats
- **HLS** (HTTP Live Streaming) - Primary format
- **DASH** (Dynamic Adaptive Streaming)
- **RTMP** (Real-Time Messaging Protocol)
- **MPEG-TS** (MPEG Transport Stream)

### Video Player
- Uses HLS.js for HLS playback
- Native HLS support for Safari
- Adaptive bitrate streaming
- Custom controls and UI

## Payment Flow

1. User selects subscription plan
2. Frontend calls `/api/payments/create-checkout`
3. Backend creates Stripe checkout session
4. User redirected to Stripe payment page
5. After payment, Stripe sends webhook
6. Backend processes webhook and creates subscription
7. User gains access to content

## Deployment Considerations

### Backend
- Use PM2 or similar process manager
- Set `NODE_ENV=production`
- Use reverse proxy (nginx)
- Enable HTTPS
- Configure proper CORS origins
- Set up database backups

### Frontend
- Build with `npm run build`
- Serve static files with nginx
- Configure API proxy
- Enable compression
- Set up CDN for assets

### Database
- Regular backups
- Connection pooling
- Index optimization
- Monitoring and alerts

## Scalability

### Horizontal Scaling
- Stateless API design
- Load balancer for multiple instances
- Shared Redis cache
- Database read replicas

### Content Delivery
- CDN for video streaming
- Multiple streaming servers
- Geographic distribution
- Adaptive bitrate for bandwidth optimization

## Future Enhancements

- [ ] Admin dashboard UI
- [ ] Mobile apps (iOS/Android)
- [ ] Smart TV apps
- [ ] Advanced analytics
- [ ] Recommendation engine
- [ ] Social features (comments, sharing)
- [ ] Multi-language support
- [ ] Parental controls
- [ ] DVR functionality
- [ ] Chromecast/AirPlay support

## Legal Compliance

⚠️ **Important**: This platform is designed for legal content distribution only.

- Ensure all content is properly licensed
- Respect geographic broadcasting rights
- Implement DRM where required
- Comply with local regulations
- Maintain proper content agreements

## Support & Maintenance

- Regular dependency updates
- Security patches
- Database optimization
- Performance monitoring
- Error logging and tracking
- User support system
