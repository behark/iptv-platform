const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
if (!process.env.VERCEL) {
  require('dotenv').config();
}

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const channelRoutes = require('./routes/channels');
const videoRoutes = require('./routes/videos');
const playlistRoutes = require('./routes/playlists');
const subscriptionRoutes = require('./routes/subscriptions');
const paymentRoutes = require('./routes/payments');
const epgRoutes = require('./routes/epg');
const exportRoutes = require('./routes/exports');
const deviceRoutes = require('./routes/devices');
const favoritesRoutes = require('./routes/favorites');
const historyRoutes = require('./routes/history');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');
const vodRoutes = require('./routes/vod');

const app = express();

const getEnvNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeOrigin = (value) =>
  value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '');

const getAllowedOrigins = () => {
  const raw =
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ORIGIN ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000';

  return raw
    .split(/[,\n]/)
    .map(normalizeOrigin)
    .filter(Boolean);
};

// Trust Render's proxy so rate limiting can read X-Forwarded-For headers.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration - allow all origins in development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);

    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, check against allowed origins
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  skip: (req) => req.path.startsWith('/exports'),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Stricter rate limit for auth routes to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const exportsWindowMinutes = getEnvNumber('EXPORTS_RATE_LIMIT_WINDOW_MINUTES', 15);
const exportsMax = getEnvNumber('EXPORTS_RATE_LIMIT_MAX', 300);
const exportsLimiter = rateLimit({
  windowMs: exportsWindowMinutes * 60 * 1000,
  max: exportsMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (token) {
      return `token:${token}`;
    }
    const mac = typeof req.query.mac === 'string' ? req.query.mac.trim() : '';
    if (mac) {
      return `mac:${mac}`;
    }
    return req.ip;
  }
});

// Stripe webhook needs raw body - must be before json parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms'));
} else {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', async (req, res) => {
  const prisma = require('./lib/prisma');
  let dbStatus = 'unknown';
  let dbError = null;
  try {
    const count = await prisma.user.count();
    dbStatus = `connected (${count} users)`;
  } catch (e) {
    dbStatus = 'error';
    dbError = e.message;
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: dbStatus,
    dbError,
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'not set',
    vercel: !!process.env.VERCEL
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/epg', epgRoutes);
app.use('/api/exports', exportsLimiter);
app.use('/api/exports', exportRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/vod', vodRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Export for Vercel serverless
module.exports = app;

// Only listen when not running on Vercel (serverless)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  const server = app.listen(PORT, () => {
    console.log(`🚀 IPTV Backend Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      const prisma = require('./lib/prisma');
      prisma.$disconnect().then(() => {
        console.log('Database connection closed.');
        process.exit(0);
      }).catch(() => {
        process.exit(1);
      });
    });
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Debug login endpoint
app.post('/debug-login', async (req, res) => {
  try {
    const prisma = require('./lib/prisma');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ step: 'findUser', error: 'not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ step: 'compare', error: 'no match' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
    res.json({ step: 'done', success: true, token: token.substring(0, 20) + '...', jwtSecret: !!process.env.JWT_SECRET });
  } catch (e) {
    res.json({ step: 'error', message: e.message, stack: e.stack?.split('\n').slice(0, 3) });
  }
});
