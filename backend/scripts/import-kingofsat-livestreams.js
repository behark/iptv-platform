#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const { validateUrlForSSRF } = require('../src/services/channelImporter');

const SOURCE_URL = 'https://en.kingofsat.net/livestreams';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36';

const COUNTRY_CODE_MAP = {
  Albania: 'AL',
  Kosovo: 'XK'
};

const DEFAULT_LANGUAGE_BY_COUNTRY = {
  AL: 'sq',
  XK: 'sq'
};

const STREAM_EXTENSIONS = ['m3u8', 'mpd', 'mp4', 'webm', 'm4v', 'mov', 'ts'];

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/');
}

function sanitizeAttr(value) {
  return value.replace(/"/g, "'").trim();
}

function isDirectStream(url) {
  return STREAM_EXTENSIONS.some(ext => new RegExp(`\\.${ext}(\\?|$)`, 'i').test(url));
}

function normalizeUrl(raw, baseUrl) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith('//')) {
      return new URL(`https:${trimmed}`).toString();
    }
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractStreamCandidates(html, baseUrl) {
  const candidates = new Set();
  const regex = new RegExp(
    `(?:https?:\\/\\/|\\/\\/|\\/)[^"'\\s<>]+\\.(${STREAM_EXTENSIONS.join('|')})[^"'\\s<>]*`,
    'gi'
  );

  let match = null;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[0];
    const normalized = normalizeUrl(raw, baseUrl);
    if (normalized) {
      candidates.add(normalized);
    }
  }

  // Catch relative file references like "stream.m3u8" without a leading slash.
  const bareRegex = new RegExp(`[^"'\\s<>]+\\.(${STREAM_EXTENSIONS.join('|')})[^"'\\s<>]*`, 'gi');
  while ((match = bareRegex.exec(html)) !== null) {
    const raw = match[0];
    const normalized = normalizeUrl(raw, baseUrl);
    if (normalized) {
      candidates.add(normalized);
    }
  }

  return Array.from(candidates);
}

function extractIframeSources(html, baseUrl) {
  const sources = new Set();
  const regex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match = null;
  while ((match = regex.exec(html)) !== null) {
    const raw = decodeEntities(match[1]);
    const normalized = normalizeUrl(raw, baseUrl);
    if (normalized) {
      sources.add(normalized);
    }
  }
  return Array.from(sources);
}

function isCloudflareChallenge(html) {
  return html.includes('cf_chl_opt') || html.includes('Just a moment...');
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': USER_AGENT },
    maxRedirects: 5,
    maxContentLength: 5 * 1024 * 1024
  });
  return typeof response.data === 'string' ? response.data : '';
}

async function resolveStreamUrl(liveUrl) {
  if (!liveUrl) return { streamUrl: null, source: 'missing-live-url' };
  if (isDirectStream(liveUrl)) return { streamUrl: liveUrl, source: 'live-url' };

  let html = '';
  let fetchUrl = liveUrl;
  let errorMessage = null;

  try {
    html = await fetchHtml(fetchUrl);
  } catch (error) {
    if (liveUrl.startsWith('http://')) {
      fetchUrl = `https://${liveUrl.slice('http://'.length)}`;
      try {
        html = await fetchHtml(fetchUrl);
      } catch (retryError) {
        errorMessage = retryError.message;
      }
    }
    if (!html) {
      return {
        streamUrl: null,
        source: 'live-fetch-failed',
        error: errorMessage || error.message,
        fetchUrl
      };
    }
  }

  if (isCloudflareChallenge(html)) {
    return { streamUrl: null, source: 'cloudflare-challenge', fetchUrl };
  }

  let candidates = extractStreamCandidates(html, fetchUrl);
  if (candidates.length > 0) {
    return { streamUrl: candidates[0], source: 'live-page', fetchUrl };
  }

  const iframeSources = extractIframeSources(html, fetchUrl);
  for (const iframeUrl of iframeSources.slice(0, 3)) {
    try {
      const iframeHtml = await fetchHtml(iframeUrl);
      candidates = extractStreamCandidates(iframeHtml, iframeUrl);
      if (candidates.length > 0) {
        return { streamUrl: candidates[0], source: 'iframe', fetchUrl };
      }
    } catch {
      // Skip iframe fetch errors.
    }
  }

  return { streamUrl: null, source: 'no-stream-found', fetchUrl };
}

function parseLivestreams(html) {
  const rows = [];
  const rowRegex = /<tr bgcolor="[^"]*">[\s\S]*?<td width="18%">[\s\S]*?<\/td>[\s\S]*?<td class="w3-hide-small" width="12%">[^<]*<\/td>/gi;
  const matches = html.match(rowRegex) || [];

  for (const row of matches) {
    const nameMatch = row.match(/class="A3"[^>]*>([^<]+)<\/a>/i);
    const liveMatch = row.match(/<A HREF="([^"]+)"[^>]*><img SRC="\/live\.jpg"/i);
    const logoMatch = row.match(/<a href="([^"]+)" class="image-link"/i);
    const countryMatch = row.match(/<td class="w3-hide-small" width="12%">([^<]*)<\/td>/i);

    const name = nameMatch ? decodeEntities(nameMatch[1]).trim() : '';
    const liveUrl = liveMatch ? decodeEntities(liveMatch[1]).trim() : '';
    const logoPath = logoMatch ? decodeEntities(logoMatch[1]).trim() : '';
    const countryName = countryMatch ? decodeEntities(countryMatch[1]).trim() : '';

    if (!name || !countryName) continue;

    rows.push({
      name,
      liveUrl,
      logoUrl: logoPath ? `https://en.kingofsat.net${logoPath}` : null,
      countryName
    });
  }

  return rows;
}

function buildM3U(entries) {
  const lines = ['#EXTM3U'];
  for (const entry of entries) {
    const attrs = [
      `tvg-name="${sanitizeAttr(entry.name)}"`,
      entry.logoUrl ? `tvg-logo="${sanitizeAttr(entry.logoUrl)}"` : null,
      entry.countryCode ? `tvg-country="${sanitizeAttr(entry.countryCode)}"` : null,
      entry.language ? `tvg-language="${sanitizeAttr(entry.language)}"` : null,
      entry.category ? `group-title="${sanitizeAttr(entry.category)}"` : null
    ].filter(Boolean);

    lines.push(`#EXTINF:-1 ${attrs.join(' ')},${entry.name}`);
    lines.push(entry.streamUrl);
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    output: null,
    report: null,
    countries: [],
    limit: null
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--output') {
      options.output = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--report') {
      options.report = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--country') {
      options.countries.push(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--limit') {
      options.limit = Number(args[i + 1]);
      i += 1;
      continue;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv);
  const targetCountries = options.countries.length > 0 ? options.countries : ['Albania', 'Kosovo'];
  const outputPath = options.output || path.join(process.cwd(), 'iptv', 'kingofsat-albania.m3u');
  const reportPath = options.report || path.join(process.cwd(), 'logs', 'kingofsat-livestreams-report.json');

  console.log('Fetching KingOfSat livestream list...');
  const listHtml = await fetchHtml(SOURCE_URL);
  const entries = parseLivestreams(listHtml);

  const filtered = entries.filter(entry => targetCountries.includes(entry.countryName));
  const limited = typeof options.limit === 'number' && Number.isFinite(options.limit)
    ? filtered.slice(0, options.limit)
    : filtered;

  if (limited.length === 0) {
    console.log('No channels matched target countries.');
    return;
  }

  const resolved = [];
  const report = [];

  for (const entry of limited) {
    const countryCode = COUNTRY_CODE_MAP[entry.countryName] || entry.countryName.toUpperCase();
    const language = DEFAULT_LANGUAGE_BY_COUNTRY[countryCode] || null;

    const resolution = await resolveStreamUrl(entry.liveUrl);

    let streamUrl = resolution.streamUrl;
    let safe = false;
    if (streamUrl) {
      safe = await validateUrlForSSRF(streamUrl);
      if (!safe) {
        streamUrl = null;
      }
    }

    report.push({
      name: entry.name,
      country: entry.countryName,
      liveUrl: entry.liveUrl,
      resolvedStreamUrl: streamUrl,
      resolutionSource: resolution.source,
      resolutionFetchUrl: resolution.fetchUrl || null,
      resolutionError: resolution.error || null,
      safe
    });

    if (streamUrl) {
      resolved.push({
        name: entry.name,
        streamUrl,
        countryCode,
        language,
        logoUrl: entry.logoUrl,
        category: 'News'
      });
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  if (resolved.length === 0) {
    console.log('No playable stream URLs resolved. Report written to:', reportPath);
    return;
  }

  const playlist = buildM3U(resolved);
  await fs.writeFile(outputPath, playlist, 'utf8');

  console.log(`Resolved ${resolved.length} streams. Playlist written to: ${outputPath}`);
  console.log(`Report written to: ${reportPath}`);
}

main().catch(error => {
  console.error('Failed to import KingOfSat livestreams:', error.message);
  process.exit(1);
});
