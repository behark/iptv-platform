const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { authenticate, requireSubscription } = require('../middleware/auth');
const { normalizeMac } = require('../utils/mac');

const router = express.Router();

const TOKEN_BYTES = 32;
const DEFAULT_EPG_DAYS = 7;
const MAX_EPG_DAYS = 14;

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
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<tv generator-info-name="iptv-platform">'
  ];

  const channelMap = new Map();
  for (const channel of channels) {
    const xmlId = channel.epgId || channel.id;
    if (!xmlId || channelMap.has(xmlId)) {
      continue;
    }
    channelMap.set(xmlId, channel);
    lines.push(`  <channel id="${escapeXml(xmlId)}">`);
    lines.push(`    <display-name>${escapeXml(channel.name || 'Channel')}</display-name>`);
    if (channel.logo) {
      lines.push(`    <icon src="${escapeXml(channel.logo)}" />`);
    }
    lines.push('  </channel>');
  }

  for (const entry of entries) {
    const channel = entry.channel;
    const xmlId = channel?.epgId || channel?.id || entry.channelId;
    if (!xmlId) {
      continue;
    }
    const start = formatXmlTvDate(entry.startTime);
    const end = formatXmlTvDate(entry.endTime);
    if (!start || !end) {
      continue;
    }
    lines.push(`  <programme start="${start}" stop="${end}" channel="${escapeXml(xmlId)}">`);
    lines.push(`    <title>${escapeXml(entry.title || 'Program')}</title>`);
    if (entry.description) {
      lines.push(`    <desc>${escapeXml(entry.description)}</desc>`);
    }
    if (entry.category) {
      lines.push(`    <category>${escapeXml(entry.category)}</category>`);
    }
    if (entry.image) {
      lines.push(`    <icon src="${escapeXml(entry.image)}" />`);
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
    orderBy: { name: 'asc' }
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

  return record;
};

const touchTokenUsage = async (tokenId) => {
  try {
    await prisma.playlistToken.update({
      where: { id: tokenId },
      data: { lastUsedAt: new Date() }
    });
  } catch (error) {
    console.warn('Failed to update playlist token usage:', error.message);
  }
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
      record = await prisma.playlistToken.create({
        data: {
          userId: req.user.id,
          deviceId: device.id,
          token
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
    const record = await prisma.playlistToken.upsert({
      where: { deviceId: device.id },
      update: {
        token,
        lastUsedAt: null,
        userId: req.user.id
      },
      create: {
        userId: req.user.id,
        deviceId: device.id,
        token
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

    const channels = await getAccessibleChannels(user, subscription);
    const baseUrl = getBaseUrl(req);
    const encodedMac = encodeURIComponent(record.device.macAddress);
    const epgUrl = `${baseUrl}/api/exports/epg.xml?token=${token}&mac=${encodedMac}`;
    const m3u = buildM3U(channels, epgUrl);

    await touchTokenUsage(record.id);

    res.set('Content-Type', 'application/x-mpegURL; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="playlist.m3u"');
    res.send(m3u);
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

    const channels = await getAccessibleChannels(user, subscription);
    const channelIds = channels.map(channel => channel.id);

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

    const entries = channelIds.length === 0
      ? []
      : await prisma.ePGEntry.findMany({
        where: {
          channelId: { in: channelIds },
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

    const xml = buildXmlTv(channels, entries);

    await touchTokenUsage(record.id);

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="epg.xml"');
    res.send(xml);
  } catch (error) {
    console.error('Export EPG error:', error);
    res.status(500).send('Server error');
  }
});

module.exports = router;
