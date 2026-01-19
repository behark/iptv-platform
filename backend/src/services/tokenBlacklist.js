// In-memory token blacklist (use Redis in production)
const blacklistedTokens = new Set();

// Clean up expired tokens every hour
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days (match JWT expiry)

// Store token with timestamp for cleanup
const tokenTimestamps = new Map();

const addToBlacklist = (token) => {
  blacklistedTokens.add(token);
  tokenTimestamps.set(token, Date.now());
};

const isBlacklisted = (token) => {
  return blacklistedTokens.has(token);
};

const removeFromBlacklist = (token) => {
  blacklistedTokens.delete(token);
  tokenTimestamps.delete(token);
};

// Cleanup old tokens periodically
const cleanup = () => {
  const now = Date.now();
  for (const [token, timestamp] of tokenTimestamps.entries()) {
    if (now - timestamp > TOKEN_EXPIRY) {
      removeFromBlacklist(token);
    }
  }
};

// Start cleanup interval
setInterval(cleanup, CLEANUP_INTERVAL);

module.exports = {
  addToBlacklist,
  isBlacklisted,
  removeFromBlacklist
};
