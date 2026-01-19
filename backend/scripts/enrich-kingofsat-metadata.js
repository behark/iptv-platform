#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const prisma = require('../src/lib/prisma');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36';
const BASE_URL = 'https://en.kingofsat.net';
const LETTERS = ['0', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

const COUNTRY_CODE_MAP = {
  Albania: 'AL',
  'Bosnia and Herzegovina': 'BA',
  'Bosnia-Herzegovina': 'BA',
  Bulgaria: 'BG',
  Croatia: 'HR',
  Greece: 'GR',
  Kosovo: 'XK',
  Macedonia: 'MK',
  'North Macedonia': 'MK',
  Montenegro: 'ME',
  Romania: 'RO',
  Serbia: 'RS',
  Slovenia: 'SI',
  Turkey: 'TR',
  'Türkiye': 'TR'
};

const BALKAN_COUNTRY_CODES = new Set(Object.values(COUNTRY_CODE_MAP));
const COUNTRY_NAMES = Object.keys(COUNTRY_CODE_MAP);

const LANGUAGE_MAP = {
  alb: 'sq',
  sqi: 'sq',
  albanian: 'sq',
  srp: 'sr',
  serbian: 'sr',
  bos: 'bs',
  bosnian: 'bs',
  hrv: 'hr',
  croatian: 'hr',
  mkd: 'mk',
  macedonian: 'mk',
  slv: 'sl',
  slovenian: 'sl',
  bul: 'bg',
  bulgarian: 'bg',
  gre: 'el',
  ell: 'el',
  greek: 'el',
  rum: 'ro',
  ron: 'ro',
  romanian: 'ro',
  tur: 'tr',
  turkish: 'tr'
};

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTrailingCountry(name) {
  let stripped = name;
  for (const country of COUNTRY_NAMES) {
    const pattern = new RegExp(`\\s*[\\(\\[]${country}[\\)\\]]\\s*$`, 'i');
    stripped = stripped.replace(pattern, '');
  }
  return stripped.trim();
}

function extractLanguage(rowHtml) {
  const match = rowHtml.match(/title="([^"]+)"[^>]*>\s*<font[^>]*>([a-z]{2,3})<\/font>/i);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const code = match[2].toLowerCase();
  return LANGUAGE_MAP[code] || LANGUAGE_MAP[name] || null;
}

function parseChannels(html) {
  const rowRegex = /<tr bgcolor="[^"]*">[\s\S]*?<td width="18%">([\s\S]*?)<\/td>\s*<td class="w3-hide-small" width="12%">([^<]*)<\/td>[\s\S]*?<\/tr>/gi;
  const rows = [];
  let match = null;

  while ((match = rowRegex.exec(html)) !== null) {
    const cell = match[1];
    const countryName = decodeEntities(match[2]).trim();
    if (!countryName || countryName === 'Country') continue;

    const nameMatch = cell.match(/class="A3"[^>]*>([^<]+)<\/a>/i);
    if (!nameMatch) continue;

    const name = decodeEntities(nameMatch[1]).trim();
    if (!name) continue;

    const logoMatch = cell.match(/<a href="([^"]+)" class="image-link"/i);
    const logoPath = logoMatch ? decodeEntities(logoMatch[1]).trim() : null;
    const rowHtml = match[0];
    const language = extractLanguage(rowHtml);

    rows.push({
      name,
      countryName,
      logoUrl: logoPath ? `${BASE_URL}${logoPath}` : null,
      language
    });
  }

  return rows;
}

async function fetchPage(letter, cacheDir, refresh) {
  const cacheFile = path.join(cacheDir, `channels_${letter}.html`);
  if (!refresh) {
    try {
      const cached = await fs.readFile(cacheFile, 'utf8');
      return cached;
    } catch {
      // Cache miss, fetch fresh.
    }
  }

  const url = `${BASE_URL}/channels_${letter}`;
  const response = await axios.get(url, {
    timeout: 30000,
    headers: { 'User-Agent': USER_AGENT },
    maxRedirects: 5
  });

  const html = typeof response.data === 'string' ? response.data : '';
  await fs.writeFile(cacheFile, html, 'utf8');
  return html;
}

function addMetadataKey(map, ambiguous, key, entry) {
  if (!key) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, entry);
    return;
  }
  if (existing.name !== entry.name || existing.countryCode !== entry.countryCode) {
    ambiguous.add(key);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    dryRun: false,
    refresh: false,
    report: path.join(process.cwd(), 'logs', 'kingofsat-metadata-report.json'),
    cacheDir: path.join(process.cwd(), 'logs', 'kingofsat-pages')
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--refresh') {
      options.refresh = true;
      continue;
    }
    if (arg === '--report') {
      options.report = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--cache-dir') {
      options.cacheDir = args[i + 1];
      i += 1;
      continue;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv);
  await fs.mkdir(options.cacheDir, { recursive: true });
  await fs.mkdir(path.dirname(options.report), { recursive: true });

  const metadata = [];

  for (const letter of LETTERS) {
    process.stdout.write(`\rFetching channels_${letter}...`);
    const html = await fetchPage(letter, options.cacheDir, options.refresh);
    const rows = parseChannels(html);
    for (const row of rows) {
      const countryCode = COUNTRY_CODE_MAP[row.countryName];
      if (!countryCode || !BALKAN_COUNTRY_CODES.has(countryCode)) continue;
      metadata.push({
        name: row.name,
        countryCode,
        language: row.language,
        logoUrl: row.logoUrl
      });
    }
  }

  process.stdout.write('\n');

  const metadataByKey = new Map();
  const ambiguousKeys = new Set();
  for (const entry of metadata) {
    addMetadataKey(metadataByKey, ambiguousKeys, normalizeName(entry.name), entry);
    const stripped = stripTrailingCountry(entry.name);
    if (stripped && stripped !== entry.name) {
      addMetadataKey(metadataByKey, ambiguousKeys, normalizeName(stripped), entry);
    }
  }

  const report = {
    stats: {
      totalMetadata: metadata.length,
      uniqueKeys: metadataByKey.size,
      ambiguousKeys: ambiguousKeys.size,
      channelsMatched: 0,
      channelsUpdated: 0
    },
    updates: [],
    skipped: []
  };

  const channels = await prisma.channel.findMany({
    select: {
      id: true,
      name: true,
      country: true,
      language: true,
      logo: true
    }
  });

  for (const channel of channels) {
    const normalized = normalizeName(channel.name || '');
    const stripped = normalizeName(stripTrailingCountry(channel.name || ''));

    let entry = metadataByKey.get(normalized);
    let matchKey = normalized;
    if (!entry) {
      entry = metadataByKey.get(stripped);
      matchKey = stripped;
    }

    if (!entry) continue;
    if (ambiguousKeys.has(matchKey)) {
      report.skipped.push({ id: channel.id, name: channel.name, reason: 'ambiguous-name' });
      continue;
    }

    const currentCountry = channel.country ? channel.country.toUpperCase() : null;
    if (currentCountry && !BALKAN_COUNTRY_CODES.has(currentCountry) && currentCountry !== 'INT') {
      report.skipped.push({ id: channel.id, name: channel.name, reason: 'non-balkan-country' });
      continue;
    }

    const updates = {};
    if (entry.logoUrl && (!channel.logo || channel.logo.trim() === '')) {
      updates.logo = entry.logoUrl;
    }
    if (entry.countryCode && (!channel.country || channel.country.trim() === '' || channel.country.toUpperCase() === 'INT')) {
      updates.country = entry.countryCode;
    }
    if (entry.language && (!channel.language || channel.language.trim() === '')) {
      updates.language = entry.language;
    }

    if (Object.keys(updates).length === 0) {
      report.skipped.push({ id: channel.id, name: channel.name, reason: 'no-updates-needed' });
      continue;
    }

    report.stats.channelsMatched += 1;
    report.updates.push({
      id: channel.id,
      name: channel.name,
      updates
    });

    if (!options.dryRun) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: updates
      });
    }

    report.stats.channelsUpdated += 1;
  }

  await fs.writeFile(options.report, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Metadata entries: ${report.stats.totalMetadata}`);
  console.log(`Unique keys: ${report.stats.uniqueKeys}`);
  console.log(`Ambiguous keys: ${report.stats.ambiguousKeys}`);
  console.log(`Channels matched: ${report.stats.channelsMatched}`);
  console.log(`Channels updated: ${report.stats.channelsUpdated}`);
  console.log(`Report written to: ${options.report}`);
  if (options.dryRun) {
    console.log('Dry run mode: no database updates applied.');
  }
}

main().catch(error => {
  console.error('Metadata enrichment failed:', error.message);
  process.exit(1);
});
