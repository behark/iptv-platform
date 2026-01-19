const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { normalizeMac } = require('../utils/mac');

const AUTO_ACTIVATE_DEVICE_EMAIL = process.env.AUTO_ACTIVATE_DEVICE_EMAIL?.trim().toLowerCase();

const ensureAutoActivatedDevice = async (normalizedMac) => {
  if (!AUTO_ACTIVATE_DEVICE_EMAIL || !normalizedMac) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      email: AUTO_ACTIVATE_DEVICE_EMAIL,
      isActive: true,
      role: {
        in: ['ADMIN', 'MODERATOR']
      }
    },
    select: {
      id: true,
      role: true,
      isActive: true
    }
  });

  if (!user) {
    return null;
  }

  const device = await prisma.device.upsert({
    where: {
      userId_macAddress: {
        userId: user.id,
        macAddress: normalizedMac
      }
    },
    update: {
      status: 'ACTIVE'
    },
    create: {
      userId: user.id,
      macAddress: normalizedMac,
      status: 'ACTIVE',
      name: `Auto-activated ${normalizedMac}`
    },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          isActive: true
        }
      }
    }
  });

  console.info(`Auto-activated device ${normalizedMac} for ${AUTO_ACTIVATE_DEVICE_EMAIL}`);
  return device;
};

const TOKEN_BYTES = 32;

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

const findDeviceWithAccess = async (macAddress) => {
  const normalized = normalizeMac(macAddress);
  if (!normalized) return null;

  let device = await prisma.device.findFirst({
    where: {
      macAddress: normalized,
      status: 'ACTIVE',
      user: {
        isActive: true
      }
    },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          isActive: true
        }
      }
    }
  });

  if (!device) {
    device = await ensureAutoActivatedDevice(normalized);
  }

  if (!device) {
    return null;
  }

  const { user } = device;
  if (['ADMIN', 'MODERATOR'].includes(user.role)) {
    return device;
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      endDate: {
        gte: new Date()
      }
    }
  });

  return subscription ? device : null;
};

const getOrCreatePlaylistToken = async (device, userId) => {
  let record = await prisma.playlistToken.findUnique({
    where: { deviceId: device.id }
  });

  if (!record) {
    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    record = await prisma.playlistToken.create({
      data: {
        userId,
        deviceId: device.id,
        token
      }
    });
  }

  return record;
};

const getBaseUrl = (req) => {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  return `${protocol}://${req.get('host')}`;
};

const buildTokenUrls = (req, record, mac) => {
  const baseUrl = getBaseUrl(req);
  const encodedMac = encodeURIComponent(mac);
  const playlistUrl = `${baseUrl}/api/exports/m3u?token=${record.token}&mac=${encodedMac}`;
  const epgUrl = `${baseUrl}/api/exports/epg.xml?token=${record.token}&mac=${encodedMac}`;
  return { playlistUrl, epgUrl };
};

module.exports = {
  findDeviceWithAccess,
  getOrCreatePlaylistToken,
  touchTokenUsage,
  buildTokenUrls,
  getBaseUrl
};
