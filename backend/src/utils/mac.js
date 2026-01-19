const MAC_LENGTH = 12;

const normalizeMac = (value) => {
  if (!value) return null;
  const raw = String(value).toUpperCase().replace(/[^A-F0-9]/g, '');
  if (raw.length !== MAC_LENGTH) return null;
  return raw.match(/.{2}/g).join(':');
};

const isMac = (value) => Boolean(normalizeMac(value));

module.exports = { normalizeMac, isMac };
