const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { validateUrlForSSRF } = require('../services/channelImporter');

const router = express.Router();

const PROXY_ENABLED = process.env.STREAM_PROXY_ENABLED !== 'false';
const UPSTREAM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MANIFEST_EXT = /\.(m3u8|m3u)(?:[?#]|$)/i;

const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.STREAM_PROXY_RATE_MAX) || 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many stream requests, slow down.' }
});

function selfBase(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}${req.baseUrl}`;
}

function proxied(base, absoluteUrl) {
  return `${base}?url=${encodeURIComponent(absoluteUrl)}`;
}

// Rewrite a single URI attribute (EXT-X-KEY / MEDIA / MAP / I-FRAME) to go through the proxy.
function rewriteAttrUri(line, manifestUrl, base) {
  return line.replace(/URI="([^"]+)"/i, (_, uri) => {
    try {
      const abs = new URL(uri, manifestUrl).toString();
      return `URI="${proxied(base, abs)}"`;
    } catch {
      return `URI="${uri}"`;
    }
  });
}

// Rewrite an HLS manifest so every segment / variant / key URL is fetched back through this proxy.
function rewriteManifest(body, manifestUrl, base) {
  const out = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const trimmed = line.trim();

    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      if (/^#EXT-X-(KEY|MEDIA|MAP|I-FRAME-STREAM-INF|SESSION-KEY)/i.test(trimmed)) {
        out.push(rewriteAttrUri(line, manifestUrl, base));
      } else {
        out.push(line);
      }
      continue;
    }

    // A bare line is a segment or a variant-playlist URI.
    try {
      const abs = new URL(trimmed, manifestUrl).toString();
      out.push(proxied(base, abs));
    } catch {
      out.push(line);
    }
  }
  return out.join('\n');
}

// @route   GET /api/stream?url=<encoded upstream url>
// @desc    CORS-safe proxy for HLS/segment URLs the browser can't fetch directly
// @access  Public (SSRF-guarded, rate-limited)
router.get('/', proxyLimiter, async (req, res) => {
  if (!PROXY_ENABLED) {
    return res.status(404).json({ success: false, message: 'Stream proxy disabled' });
  }

  const target = req.query.url;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing url parameter' });
  }

  const isSafe = await validateUrlForSSRF(target);
  if (!isSafe) {
    return res.status(403).json({ success: false, message: 'Blocked URL' });
  }

  let upstream;
  try {
    upstream = await axios.get(target, {
      responseType: 'stream',
      timeout: 20000,
      maxRedirects: 5,
      // Live streams have no fixed length; don't let axios buffer a cap.
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        'User-Agent': UPSTREAM_UA,
        ...(req.headers.range ? { Range: req.headers.range } : {}),
        ...(req.headers['accept'] ? { Accept: req.headers['accept'] } : {})
      },
      validateStatus: (s) => s >= 200 && s < 400
    });
  } catch (error) {
    const status = error.response?.status || 502;
    return res.status(status).json({ success: false, message: `Upstream error: ${error.message}` });
  }

  const finalUrl = upstream.request?.res?.responseUrl || target;
  const contentType = (upstream.headers['content-type'] || '').toLowerCase();
  const isManifest = contentType.includes('mpegurl') ||
    contentType.includes('vnd.apple.mpegurl') ||
    MANIFEST_EXT.test(finalUrl) ||
    MANIFEST_EXT.test(target);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (isManifest) {
    // Buffer the (small) manifest so we can rewrite child URLs to route back here.
    const chunks = [];
    upstream.data.on('data', (c) => chunks.push(c));
    upstream.data.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      const rewritten = rewriteManifest(body, finalUrl, selfBase(req));
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.status(upstream.status).send(rewritten);
    });
    upstream.data.on('error', () => {
      if (!res.headersSent) res.status(502).json({ success: false, message: 'Manifest stream error' });
    });
    return;
  }

  // Binary segment / key / init: stream straight through.
  if (upstream.headers['content-type']) res.setHeader('Content-Type', upstream.headers['content-type']);
  if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length']);
  if (upstream.headers['accept-ranges']) res.setHeader('Accept-Ranges', upstream.headers['accept-ranges']);
  if (upstream.headers['content-range']) res.setHeader('Content-Range', upstream.headers['content-range']);
  res.status(upstream.status);
  upstream.data.pipe(res);
  upstream.data.on('error', () => res.destroy());
  req.on('close', () => upstream.data.destroy());
});

module.exports = router;
