const crypto = require('crypto');
const express = require('express');
const util = require('util');
const zlib = require('zlib');
const prisma = require('../lib/prisma');
const { authenticate, requireSubscription } = require('../middleware/auth');
const {
  findDeviceWithAccess,
  getOrCreatePlaylistToken,
  touchTokenUsage,
  buildTokenUrls,
  getPlaylistTokenExpiry
} = require('../services/deviceAccess');
const { normalizeMac } = require('../utils/mac');

const router = express.Router();

const gzip = util.promisify(zlib.gzip);

const TOKEN_BYTES = 32;
const DEFAULT_EPG_DAYS = 7;
const MAX_EPG_DAYS = 14;

const getEnvNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PLAYLIST_CACHE_TTL_SECONDS = getEnvNumber('PLAYLIST_CACHE_TTL_SECONDS', 300);
const EPG_CACHE_TTL_SECONDS = getEnvNumber('EPG_CACHE_TTL_SECONDS', 300);
const PLAYLIST_CACHE_MAX_ITEMS = getEnvNumber('PLAYLIST_CACHE_MAX_ITEMS', 50);
const EPG_CACHE_MAX_ITEMS = getEnvNumber('EPG_CACHE_MAX_ITEMS', 10);

const playlistCache = new Map();
const epgCache = new Map();

const getCacheEntry = (cache, key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry;
};

const setCacheEntry = (cache, key, value, ttlSeconds, maxItems) => {
  if (!ttlSeconds || ttlSeconds <= 0 || maxItems <= 0) return;
  const expiresAt = Date.now() + ttlSeconds * 1000;
  cache.set(key, { value, expiresAt, createdAt: Date.now() });
  if (cache.size > maxItems) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
};

const sendExport = async (req, res, body, { contentType, filename, cacheSeconds }) => {
  res.set('Content-Type', contentType);
  res.set('Vary', 'Accept-Encoding');
  if (filename) {
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
  }
  if (cacheSeconds && cacheSeconds > 0) {
    res.set('Cache-Control', `public, max-age=${cacheSeconds}`);
  } else {
    res.set('Cache-Control', 'no-store');
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (acceptEncoding.includes('gzip')) {
    try {
      const compressed = await gzip(body);
      res.set('Content-Encoding', 'gzip');
      return res.send(compressed);
    } catch (error) {
      console.warn('Failed to gzip export:', error.message);
    }
  }

  return res.send(body);
};

const getExportCacheKey = (user, subscription, suffix) => {
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') {
    return `admin:${suffix}`;
  }
  return `plan:${subscription?.planId || 'none'}:${suffix}`;
};

const getBaseUrl = (req) => {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  return `${protocol}://${req.get('host')}`;
};

const sanitizeM3uValue = (value) => {
  if (!value) return '';
  return String(value).replace(/"/g, "'").replace(/\r?\n/g, ' ').trim();
};

const escapeXml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const formatXmlTvDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())} +0000`;
};

const buildM3U = (channels, epgUrl) => {
  const header = epgUrl
    ? `#EXTM3U url-tvg="${epgUrl}" x-tvg-url="${epgUrl}"`
    : '#EXTM3U';
  const lines = [header];

  for (const channel of channels) {
    if (!channel.streamUrl) {
      continue;
    }
    const name = sanitizeM3uValue(channel.name || 'Channel');
    const attrs = [];
    const tvgId = sanitizeM3uValue(channel.epgId || channel.id);
    if (tvgId) attrs.push(`tvg-id="${tvgId}"`);
    if (name) attrs.push(`tvg-name="${name}"`);
    const logo = sanitizeM3uValue(channel.logo);
    if (logo) attrs.push(`tvg-logo="${logo}"`);
    const group = sanitizeM3uValue(channel.category || 'Uncategorized');
    if (group) attrs.push(`group-title="${group}"`);
    const country = sanitizeM3uValue(channel.country);
    if (country) attrs.push(`tvg-country="${country}"`);
    const language = sanitizeM3uValue(channel.language);
    if (language) attrs.push(`tvg-language="${language}"`);
    const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';

    lines.push(`#EXTINF:-1${attrText},${name}`);
    lines.push(channel.streamUrl);
  }

  return lines.join('\n');
};

const buildXmlTv = (channels, entries) => {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="iptv-platform">'];
  const seenChannelIds = new Set();

  for (const channel of channels) {
    const channelId = channel.epgId || channel.id;
    if (!channelId || seenChannelIds.has(channelId)) {
      continue;
    }
    seenChannelIds.add(channelId);

    lines.push(`  <channel id="${escapeXml(channelId)}">`);
    const name = escapeXml(channel.name || 'Channel');
    lines.push(`    <display-name>${name}</display-name>`);
    if (channel.logo) {
      lines.push(`    <icon src="${escapeXml(channel.logo)}"/>`);
    }
    lines.push('  </channel>');
  }

  for (const entry of entries) {
    const channel = entry.channel || {};
    const channelId = channel.epgId || channel.id || entry.channelId;
    const start = formatXmlTvDate(entry.startTime);
    const stop = formatXmlTvDate(entry.endTime);

    if (!channelId || !start || !stop) {
      continue;
    }

    lines.push(`  <programme start="${start}" stop="${stop}" channel="${escapeXml(channelId)}">`);
    if (entry.title) {
      lines.push(`    <title>${escapeXml(entry.title)}</title>`);
    }
    if (entry.description) {
      lines.push(`    <desc>${escapeXml(entry.description)}</desc>`);
    }
    if (entry.category) {
      lines.push(`    <category>${escapeXml(entry.category)}</category>`);
    }
    if (entry.image) {
      lines.push(`    <icon src="${escapeXml(entry.image)}"/>`);
    }
    lines.push('  </programme>');
  }

  lines.push('</tv>');
  return lines.join('\n');
};

const getActiveSubscription = async (userId) => {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      endDate: {
        gte: new Date()
      }
    },
    select: {
      planId: true
    }
  });
};

const getAccessibleChannels = async (user, subscription) => {
  const where = {
    isActive: true,
    isLive: true
  };

  if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
    if (!subscription) {
      return [];
    }
    const access = await prisma.channelAccess.findMany({
      where: { planId: subscription.planId },
      select: { channelId: true }
    });
    const allowedIds = access.map(item => item.channelId);
    if (allowedIds.length === 0) {
      return [];
    }
    where.id = { in: allowedIds };
  }

  return prisma.channel.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' }
    ]
  });
};

const getAccessibleChannelCount = async (user, subscription) => {
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') {
    return prisma.channel.count({
      where: {
        isActive: true,
        isLive: true
      }
    });
  }

  if (!subscription) {
    return 0;
  }

  return prisma.channelAccess.count({
    where: {
      planId: subscription.planId,
      channel: {
        isActive: true,
        isLive: true
      }
    }
  });
};

const getActiveDevice = async (userId, macAddress) => {
  const normalized = normalizeMac(macAddress);
  if (!normalized) {
    return null;
  }
  return prisma.device.findFirst({
    where: {
      userId,
      macAddress: normalized,
      status: 'ACTIVE'
    }
  });
};

const resolveToken = async (token, macAddress) => {
  if (!token) return null;
  const normalized = normalizeMac(macAddress);
  if (!normalized) {
    return null;
  }

  const record = await prisma.playlistToken.findUnique({
    where: { token },
    include: {
      device: {
        include: {
          user: {
            select: {
              id: true,
              role: true,
              isActive: true
            }
          }
        }
      }
    }
  });

  if (!record || !record.device || record.device.status !== 'ACTIVE') {
    return null;
  }
  if (record.device.macAddress !== normalized) {
    return null;
  }
  if (!record.device.user || !record.device.user.isActive) {
    return null;
  }
  if (record.expiresAt && record.expiresAt <= new Date()) {
    return null;
  }
  if (!record.expiresAt) {
    const expiresAt = getPlaylistTokenExpiry();
    if (expiresAt) {
      try {
        await prisma.playlistToken.update({
          where: { id: record.id },
          data: { expiresAt }
        });
        record.expiresAt = expiresAt;
      } catch (error) {
        console.warn('Failed to set playlist token expiry:', error.message);
      }
    }
  }

  return record;
};

// @route   GET /api/exports/playlist-token
// @desc    Get or create playlist token and URLs (device-bound)
// @access  Private (requires subscription)
router.get('/playlist-token', authenticate, requireSubscription, async (req, res) => {
  try {
    const deviceMac = req.query.mac || req.body?.mac;
    if (!deviceMac) {
      return res.status(400).json({
        success: false,
        message: 'MAC address is required to fetch playlist links'
      });
    }

    const device = await getActiveDevice(req.user.id, deviceMac);
    if (!device) {
      return res.status(403).json({
        success: false,
        message: 'Device not registered or inactive'
      });
    }

    let record = await prisma.playlistToken.findUnique({
      where: { deviceId: device.id }
    });

    if (!record) {
      const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
      const expiresAt = getPlaylistTokenExpiry();
      record = await prisma.playlistToken.create({
        data: {
          userId: req.user.id,
          deviceId: device.id,
          token,
          ...(expiresAt ? { expiresAt } : {})
        }
      });
    }

    const baseUrl = getBaseUrl(req);
    const encodedMac = encodeURIComponent(device.macAddress);
    const playlistUrl = `${baseUrl}/api/exports/m3u?token=${record.token}&mac=${encodedMac}`;
    const epgUrl = `${baseUrl}/api/exports/epg.xml?token=${record.token}&mac=${encodedMac}`;

    res.json({
      success: true,
      data: {
        token: record.token,
        playlistUrl,
        epgUrl
      }
    });
  } catch (error) {
    console.error('Get playlist token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/exports/playlist-token
// @desc    Rotate playlist token and URLs (device-bound)
// @access  Private (requires subscription)
router.post('/playlist-token', authenticate, requireSubscription, async (req, res) => {
  try {
    const deviceMac = req.query.mac || req.body?.mac;
    if (!deviceMac) {
      return res.status(400).json({
        success: false,
        message: 'MAC address is required to rotate playlist token'
      });
    }

    const device = await getActiveDevice(req.user.id, deviceMac);
    if (!device) {
      return res.status(403).json({
        success: false,
        message: 'Device not registered or inactive'
      });
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = getPlaylistTokenExpiry();
    const record = await prisma.playlistToken.upsert({
      where: { deviceId: device.id },
      update: {
        token,
        lastUsedAt: null,
        userId: req.user.id,
        ...(expiresAt ? { expiresAt } : {})
      },
      create: {
        userId: req.user.id,
        deviceId: device.id,
        token,
        ...(expiresAt ? { expiresAt } : {})
      }
    });

    const baseUrl = getBaseUrl(req);
    const encodedMac = encodeURIComponent(device.macAddress);
    const playlistUrl = `${baseUrl}/api/exports/m3u?token=${record.token}&mac=${encodedMac}`;
    const epgUrl = `${baseUrl}/api/exports/epg.xml?token=${record.token}&mac=${encodedMac}`;

    res.json({
      success: true,
      data: {
        token: record.token,
        playlistUrl,
        epgUrl,
        rotated: true
      }
    });
  } catch (error) {
    console.error('Rotate playlist token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/exports/health
// @desc    Validate token and return accessible channel counts
// @access  Public (token + device MAC)
router.get('/health', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const macAddress = req.query.mac;
    if (!macAddress) {
      return res.status(400).json({
        success: false,
        message: 'MAC address is required'
      });
    }

    const record = await resolveToken(token, macAddress);
    if (!record) {
      return res.status(401).json({
        success: false,
        message: 'Invalid playlist token or device'
      });
    }

    const user = record.device.user;
    const subscription = (user.role === 'ADMIN' || user.role === 'MODERATOR')
      ? null
      : await getActiveSubscription(user.id);
    if (user.role !== 'ADMIN' && user.role !== 'MODERATOR' && !subscription) {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required'
      });
    }

    const channelCount = await getAccessibleChannelCount(user, subscription);

    return res.json({
      success: true,
      data: {
        device: {
          id: record.device.id,
          macAddress: record.device.macAddress,
          status: record.device.status
        },
        user: {
          id: user.id,
          role: user.role
        },
        subscription: subscription ? { planId: subscription.planId } : null,
        channels: {
          count: channelCount
        },
        token: {
          lastUsedAt: record.lastUsedAt,
          expiresAt: record.expiresAt
        }
      }
    });
  } catch (error) {
    console.error('Export health error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/exports/m3u
// @desc    Export M3U playlist for token
// @access  Public (token + device MAC)
router.get('/m3u', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const macAddress = req.query.mac;
    if (!macAddress) {
      return res.status(400).send('MAC address is required');
    }

    const record = await resolveToken(token, macAddress);
    if (!record) {
      return res.status(401).send('Invalid playlist token or device');
    }

    const user = record.device.user;
    const subscription = (user.role === 'ADMIN' || user.role === 'MODERATOR')
      ? null
      : await getActiveSubscription(user.id);
    if (user.role !== 'ADMIN' && user.role !== 'MODERATOR' && !subscription) {
      return res.status(403).send('Active subscription required');
    }

    const cacheKey = getExportCacheKey(user, subscription, `playlist:${token}`);
    const cached = getCacheEntry(playlistCache, cacheKey);
    let m3u = cached?.value;

    if (!m3u) {
      const channels = await getAccessibleChannels(user, subscription);
      const baseUrl = getBaseUrl(req);
      const encodedMac = encodeURIComponent(record.device.macAddress);
      const epgUrl = `${baseUrl}/api/exports/epg.xml?token=${token}&mac=${encodedMac}`;
      m3u = buildM3U(channels, epgUrl);
      setCacheEntry(playlistCache, cacheKey, m3u, PLAYLIST_CACHE_TTL_SECONDS, PLAYLIST_CACHE_MAX_ITEMS);
    }

    await touchTokenUsage(record.id);

    return sendExport(req, res, m3u, {
      contentType: 'application/x-mpegURL; charset=utf-8',
      filename: 'playlist.m3u',
      cacheSeconds: PLAYLIST_CACHE_TTL_SECONDS
    });
  } catch (error) {
    console.error('Export M3U error:', error);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/exports/epg.xml
// @desc    Export XMLTV EPG for token
// @access  Public (token + device MAC)
router.get('/epg.xml', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const macAddress = req.query.mac;
    if (!macAddress) {
      return res.status(400).send('MAC address is required');
    }

    const record = await resolveToken(token, macAddress);
    if (!record) {
      return res.status(401).send('Invalid playlist token or device');
    }

    const user = record.device.user;
    const subscription = (user.role === 'ADMIN' || user.role === 'MODERATOR')
      ? null
      : await getActiveSubscription(user.id);
    if (user.role !== 'ADMIN' && user.role !== 'MODERATOR' && !subscription) {
      return res.status(403).send('Active subscription required');
    }

    const startParam = req.query.start;
    const endParam = req.query.end;
    const daysParam = parseInt(req.query.days, 10);

    const start = startParam ? new Date(startParam) : new Date();
    let end = endParam ? new Date(endParam) : null;

    const days = Number.isFinite(daysParam)
      ? Math.min(Math.max(daysParam, 1), MAX_EPG_DAYS)
      : DEFAULT_EPG_DAYS;

    if (!end || Number.isNaN(end.getTime())) {
      end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    }

    if (Number.isNaN(start.getTime()) || end <= start) {
      return res.status(400).send('Invalid EPG time range');
    }

    const cacheKey = getExportCacheKey(
      user,
      subscription,
      `epg:${start.toISOString()}:${end.toISOString()}`
    );
    const cached = getCacheEntry(epgCache, cacheKey);
    let xml = cached?.value;

    if (!xml) {
      const channels = await getAccessibleChannels(user, subscription);
      const channelIds = Array.from(new Set(channels.map(channel => channel.id)));

      const entries = [];
      if (channelIds.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < channelIds.length; i += chunkSize) {
          const chunk = channelIds.slice(i, i + chunkSize);
          const chunkEntries = await prisma.ePGEntry.findMany({
            where: {
              channelId: { in: chunk },
              startTime: { lt: end },
              endTime: { gt: start }
            },
            include: {
              channel: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  epgId: true
                }
              }
            },
            orderBy: [
              { channelId: 'asc' },
              { startTime: 'asc' }
            ]
          });
          entries.push(...chunkEntries);
        }
        entries.sort((a, b) => {
          if (a.channelId < b.channelId) return -1;
          if (a.channelId > b.channelId) return 1;
          return new Date(a.startTime) - new Date(b.startTime);
        });
      }

      xml = buildXmlTv(channels, entries);
      setCacheEntry(epgCache, cacheKey, xml, EPG_CACHE_TTL_SECONDS, EPG_CACHE_MAX_ITEMS);
    }

    await touchTokenUsage(record.id);

    return sendExport(req, res, xml, {
      contentType: 'application/xml; charset=utf-8',
      filename: 'epg.xml',
      cacheSeconds: EPG_CACHE_TTL_SECONDS
    });
  } catch (error) {
    console.error('Export EPG error:', error);
    res.status(500).send('Server error');
  }
});

router.get('/tv/playlist/:mac', async (req, res) => {
  try {
    const device = await findDeviceWithAccess(req.params.mac);
    if (!device) {
      return res.status(403).json({ success: false, message: 'Device not registered or subscription required' });
    }

    const tokenRecord = await getOrCreatePlaylistToken(device, device.user.id);
    await touchTokenUsage(tokenRecord.id);

    const { playlistUrl } = buildTokenUrls(req, tokenRecord, device.macAddress);
    return res.redirect(playlistUrl);
  } catch (error) {
    console.error('Redirect playlist error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/exports/siptv/:mac
// @desc    Direct M3U playlist for Smart IPTV (no redirects, SIPTV-compatible)
// @access  Public (MAC-based auth)
router.get('/siptv/:mac', async (req, res) => {
  try {
    const device = await findDeviceWithAccess(req.params.mac);
    if (!device) {
      // Return empty playlist with error comment for SIPTV
      return res.set('Content-Type', 'audio/x-mpegurl').send('#EXTM3U\n#EXTINF:-1,Device not registered or no subscription\nhttp://error');
    }

    const user = device.user;
    const subscription = (user.role === 'ADMIN' || user.role === 'MODERATOR')
      ? null
      : await getActiveSubscription(user.id);

    if (user.role !== 'ADMIN' && user.role !== 'MODERATOR' && !subscription) {
      return res.set('Content-Type', 'audio/x-mpegurl').send('#EXTM3U\n#EXTINF:-1,Subscription expired\nhttp://error');
    }

    // Get channels
    const channels = await getAccessibleChannels(user, subscription);

    // Build EPG URL
    const baseUrl = getBaseUrl(req);
    const epgUrl = `${baseUrl}/api/exports/siptv/${req.params.mac}/epg`;

    // Build M3U
    const m3u = buildM3U(channels, epgUrl);

    // Update token usage if exists
    const tokenRecord = await getOrCreatePlaylistToken(device, user.id);
    if (tokenRecord) {
      await touchTokenUsage(tokenRecord.id);
    }

    // Send with SIPTV-friendly headers (no redirects, proper content-type)
    res.set('Content-Type', 'audio/x-mpegurl');
    res.set('Content-Disposition', 'inline');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Access-Control-Allow-Origin', '*');
    return res.send(m3u);
  } catch (error) {
    console.error('SIPTV playlist error:', error);
    return res.set('Content-Type', 'audio/x-mpegurl').send('#EXTM3U\n#EXTINF:-1,Server error\nhttp://error');
  }
});

// @route   GET /api/exports/siptv/:mac/epg
// @desc    Direct EPG for Smart IPTV (no redirects)
// @access  Public (MAC-based auth)
router.get('/siptv/:mac/epg', async (req, res) => {
  try {
    const device = await findDeviceWithAccess(req.params.mac);
    if (!device) {
      return res.status(403).set('Content-Type', 'application/xml').send('<?xml version="1.0" encoding="UTF-8"?><tv></tv>');
    }

    const user = device.user;
    const subscription = (user.role === 'ADMIN' || user.role === 'MODERATOR')
      ? null
      : await getActiveSubscription(user.id);

    if (user.role !== 'ADMIN' && user.role !== 'MODERATOR' && !subscription) {
      return res.status(403).set('Content-Type', 'application/xml').send('<?xml version="1.0" encoding="UTF-8"?><tv></tv>');
    }

    const channels = await getAccessibleChannels(user, subscription);
    const channelIds = Array.from(new Set(channels.map(channel => channel.id)));

    const start = new Date();
    const end = new Date(start.getTime() + DEFAULT_EPG_DAYS * 24 * 60 * 60 * 1000);

    const entries = [];
    if (channelIds.length > 0) {
      const chunkSize = 1000;
      for (let i = 0; i < channelIds.length; i += chunkSize) {
        const chunk = channelIds.slice(i, i + chunkSize);
        const chunkEntries = await prisma.ePGEntry.findMany({
          where: {
            channelId: { in: chunk },
            startTime: { lt: end },
            endTime: { gt: start }
          },
          include: {
            channel: {
              select: { id: true, name: true, logo: true, epgId: true }
            }
          },
          orderBy: [{ channelId: 'asc' }, { startTime: 'asc' }]
        });
        entries.push(...chunkEntries);
      }
    }

    const xml = buildXmlTv(channels, entries);

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Content-Disposition', 'inline');
    res.set('Cache-Control', 'no-cache');
    res.set('Access-Control-Allow-Origin', '*');
    return res.send(xml);
  } catch (error) {
    console.error('SIPTV EPG error:', error);
    return res.status(500).set('Content-Type', 'application/xml').send('<?xml version="1.0" encoding="UTF-8"?><tv></tv>');
  }
});

router.get('/tv/epg/:mac', async (req, res) => {
  try {
    const device = await findDeviceWithAccess(req.params.mac);
    if (!device) {
      return res.status(403).json({ success: false, message: 'Device not registered or subscription required' });
    }

    const tokenRecord = await getOrCreatePlaylistToken(device, device.user.id);
    await touchTokenUsage(tokenRecord.id);

    const { epgUrl } = buildTokenUrls(req, tokenRecord, device.macAddress);
    return res.redirect(epgUrl);
  } catch (error) {
    console.error('Redirect epg error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
