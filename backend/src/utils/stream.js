const FILE_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'ogv',
  'ogg',
  'mkv',
  'avi',
  'mov',
  'm4v'
]);

const EXTERNAL_HOSTS = [
  'dailymotion.com',
  'vimeo.com',
  'twitch.tv',
  'facebook.com',
  'rumble.com',
  'odysee.com'
];

const extractExtension = (url) => {
  if (!url) return null;
  const match = url.match(/\.([a-z0-9]{2,8})(?:[?#]|$)/i);
  return match ? match[1].toLowerCase() : null;
};

const normalizeStreamInfo = (url) => {
  if (!url || typeof url !== 'string') {
    return { streamType: 'UNKNOWN', fileExt: null };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { streamType: 'UNKNOWN', fileExt: null };
  }

  const lower = trimmed.toLowerCase();

  if (lower.startsWith('rtmp://') || lower.startsWith('rtmps://')) {
    return { streamType: 'RTMP_INGEST', fileExt: null };
  }

  const ext = extractExtension(lower);
  if (ext === 'm3u8' || ext === 'm3u') {
    return { streamType: 'HLS', fileExt: null };
  }
  if (ext === 'mpd') {
    return { streamType: 'DASH', fileExt: null };
  }
  if (ext === 'ts') {
    return { streamType: 'MPEGTS', fileExt: null };
  }

  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return { streamType: 'YOUTUBE', fileExt: null };
  }

  if (EXTERNAL_HOSTS.some((host) => lower.includes(host))) {
    return { streamType: 'EXTERNAL', fileExt: null };
  }

  if (ext && FILE_EXTENSIONS.has(ext)) {
    return { streamType: 'FILE', fileExt: ext };
  }

  return { streamType: 'UNKNOWN', fileExt: null };
};

const detectStreamInfo = (url) => normalizeStreamInfo(url);
const detectStreamType = (url) => normalizeStreamInfo(url).streamType;

module.exports = {
  detectStreamInfo,
  detectStreamType,
  normalizeStreamInfo
};
