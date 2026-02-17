#!/usr/bin/env node

/**
 * Import channels from CloudTVE (HTML scraping) and bitsbb01/storage M3U files.
 *
 * Usage:
 *   node scripts/import-scraped-sources.js [source] [options]
 *
 * Sources:
 *   all           Import from all sources (default)
 *   cloudtve      Scrape CloudTVE only
 *   bitsbb01      Import bitsbb01/storage M3Us only
 *
 * Options:
 *   --no-validate    Skip stream health checking (default)
 *   --validate       Enable stream health checking
 *   --dry-run        Parse but don't write to DB
 *   --concurrency N  Parallel validation workers (default: 10)
 *   --timeout MS     Validation timeout (default: 5000)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const {
  importFromUrl,
  validateStream,
  buildChannelData,
  upsertImportedChannel,
  dedupeChannelsByStreamUrl
} = require('../src/services/channelImporter');
const { detectStreamInfo } = require('../src/utils/stream');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const source = (!args[0] || args[0].startsWith('--')) ? 'all' : args[0];

function flagValue(name, defaultVal) {
  const idx = args.indexOf(name);
  if (idx === -1) return defaultVal;
  return args[idx + 1] !== undefined ? args[idx + 1] : defaultVal;
}

const dryRun = args.includes('--dry-run');
const validate = args.includes('--validate') && !args.includes('--no-validate');
const concurrency = parseInt(flagValue('--concurrency', '10'), 10);
const validationTimeout = parseInt(flagValue('--timeout', '5000'), 10);

// ---------------------------------------------------------------------------
// CloudTVE scraper
// ---------------------------------------------------------------------------

const CLOUDTVE_URL = 'https://cloudtve.com';
const CLOUDTVE_PAGINATION_URL = 'https://cloudtve.com/m3u8/any/null/null';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Decode CloudTVE's char-code-obfuscated stream URL.
 * The hostname portion of `/cors-free/104:116:...:118/playlist.m3u8` is encoded
 * as colon-separated ASCII char codes.
 */
function decodeCloudTVEUrl(dataUrl) {
  if (!dataUrl) return null;
  const withoutPrefix = dataUrl.replace('/cors-free/', '');
  const slashIdx = withoutPrefix.indexOf('/');
  if (slashIdx === -1) return null;
  const encodedHost = withoutPrefix.substring(0, slashIdx);
  const pathPart = withoutPrefix.substring(slashIdx);
  try {
    const decoded = encodedHost
      .split(':')
      .map(c => String.fromCharCode(parseInt(c, 10)))
      .join('');
    if (!decoded) return null;
    // The encoded portion may already include the protocol (e.g. "https://host")
    const url = decoded.startsWith('http://') || decoded.startsWith('https://')
      ? decoded + pathPart
      : 'https://' + decoded + pathPart;
    // Basic sanity check
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Extract channel objects from a cheerio-parsed HTML page.
 */
function extractChannelsFromHTML($) {
  const channels = [];
  $('button.watchBtn').each((_, el) => {
    const btn = $(el);
    const name = btn.attr('data-name');
    const rawUrl = btn.attr('data-url');
    const country = btn.attr('data-countryid');
    const category = btn.attr('data-categories');
    const language = btn.attr('data-languages');
    const logo = btn.attr('data-cdnthumb');

    if (!name || !rawUrl) return;

    const streamUrl = decodeCloudTVEUrl(rawUrl);
    if (!streamUrl) return;

    channels.push({ name, streamUrl, country, category, language, logo });
  });
  return channels;
}

/**
 * Build the comma-separated exclusion string CloudTVE expects for pagination.
 * It uses a compact ID like "YahooFinance.us" derived from name + country.
 */
function buildExclusionId(channel) {
  const safeName = (channel.name || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 40);
  const country = (channel.country || '').toLowerCase();
  return `${safeName}.${country}`;
}

async function scrapeCloudTVE() {
  console.log('\n=== CloudTVE Scraper ===');
  console.log(`Fetching initial page: ${CLOUDTVE_URL}`);

  const allChannels = [];
  const seenUrls = new Set();

  // Step 1: Fetch initial page
  const { data: html } = await axios.get(CLOUDTVE_URL, {
    timeout: 30000,
    headers: { 'User-Agent': USER_AGENT }
  });

  const $ = cheerio.load(html);
  const initial = extractChannelsFromHTML($);
  console.log(`Initial page: ${initial.length} channels`);

  for (const ch of initial) {
    if (!seenUrls.has(ch.streamUrl)) {
      seenUrls.add(ch.streamUrl);
      allChannels.push(ch);
    }
  }

  // Step 2: Paginate until exhausted
  let page = 1;
  let consecutiveEmpty = 0;
  const MAX_PAGES = 200; // safety limit

  while (page < MAX_PAGES && consecutiveEmpty < 3) {
    const exclusionIds = allChannels.map(buildExclusionId).join(',');

    try {
      const { data: pageHtml } = await axios.post(CLOUDTVE_PAGINATION_URL, exclusionIds, {
        timeout: 30000,
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'text/plain',
          'Referer': CLOUDTVE_URL
        }
      });

      const $page = cheerio.load(pageHtml);
      const pageChannels = extractChannelsFromHTML($page);

      if (pageChannels.length === 0) {
        consecutiveEmpty++;
        page++;
        continue;
      }

      consecutiveEmpty = 0;
      let newCount = 0;
      for (const ch of pageChannels) {
        if (!seenUrls.has(ch.streamUrl)) {
          seenUrls.add(ch.streamUrl);
          allChannels.push(ch);
          newCount++;
        }
      }

      page++;
      console.log(`  Page ${page}: ${pageChannels.length} returned, ${newCount} new (total: ${allChannels.length})`);

      // Brief pause between requests
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  Pagination error on page ${page + 1}: ${err.message}`);
      consecutiveEmpty++;
      page++;
    }
  }

  console.log(`CloudTVE scraping complete: ${allChannels.length} unique channels found`);
  return allChannels;
}

// ---------------------------------------------------------------------------
// bitsbb01/storage M3U sources
// ---------------------------------------------------------------------------

const BITSBB01_BASE = 'https://raw.githubusercontent.com/bitsbb01/storage/main/';

const BITSBB01_FILES = [
  { file: 'tubi.m3u', label: 'Tubi FAST channels' },
  { file: 'squidtv.m3u8', label: 'SquidTV niche UK/US' },
  { file: 'cxtvlive.m3u8', label: 'CXTv live' },
  { file: '30atv.m3u8', label: '30A TV coastal lifestyle' }
];

async function importBitsbb01() {
  console.log('\n=== bitsbb01/storage M3U Import ===');

  const totals = { imported: 0, updated: 0, skipped: 0, failed: 0, total: 0 };

  for (const { file, label } of BITSBB01_FILES) {
    const url = BITSBB01_BASE + file;
    console.log(`\n  ${label} (${file})`);

    if (dryRun) {
      try {
        const { data } = await axios.get(url, {
          timeout: 30000,
          headers: { 'User-Agent': USER_AGENT },
          maxContentLength: 50 * 1024 * 1024
        });
        const lines = data.split('\n');
        const streamCount = lines.filter(l => l.trim().startsWith('http')).length;
        console.log(`    [dry-run] Would import ~${streamCount} channels`);
        totals.total += streamCount;
      } catch (err) {
        console.error(`    [dry-run] Fetch failed: ${err.message}`);
        totals.failed++;
      }
      continue;
    }

    try {
      const result = await importFromUrl(url, { validateStreams: validate });
      console.log(`    Imported: ${result.imported} | Updated: ${result.updated} | Skipped: ${result.skipped} | Failed: ${result.failed}`);
      totals.imported += result.imported;
      totals.updated += result.updated;
      totals.skipped += result.skipped;
      totals.failed += result.failed;
      totals.total += result.total;
    } catch (err) {
      console.error(`    Error: ${err.message}`);
      totals.failed++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return totals;
}

// ---------------------------------------------------------------------------
// CloudTVE import (process scraped channels through DB)
// ---------------------------------------------------------------------------

async function importCloudTVEChannels(channels) {
  console.log(`\nImporting ${channels.length} CloudTVE channels into DB...`);

  const deduped = dedupeChannelsByStreamUrl(
    channels.map(ch => {
      const streamInfo = detectStreamInfo(ch.streamUrl);
      return {
        name: ch.name,
        streamUrl: ch.streamUrl,
        streamType: streamInfo.streamType,
        fileExt: streamInfo.fileExt,
        country: ch.country ? ch.country.toUpperCase() : null,
        category: ch.category || null,
        language: ch.language || null,
        logo: ch.logo || null,
        description: ch.name
      };
    })
  );

  console.log(`After dedup: ${deduped.length} unique channels`);

  const totals = { imported: 0, updated: 0, skipped: 0, failed: 0, total: deduped.length };

  if (dryRun) {
    console.log(`[dry-run] Would process ${deduped.length} channels`);

    // Show a sample
    const sample = deduped.slice(0, 5);
    for (const ch of sample) {
      console.log(`  - ${ch.name} [${ch.country || '??'}] ${ch.streamUrl.substring(0, 80)}...`);
    }
    if (deduped.length > 5) {
      console.log(`  ... and ${deduped.length - 5} more`);
    }
    return totals;
  }

  // Process with optional validation
  const batchSize = 100;
  for (let i = 0; i < deduped.length; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);

    // Validate in parallel batches if enabled
    if (validate) {
      const validationResults = await Promise.all(
        batch.map(ch =>
          validateStream(ch.streamUrl, validationTimeout)
            .then(valid => ({ ch, valid }))
            .catch(() => ({ ch, valid: false }))
        )
      );

      for (const { ch, valid } of validationResults) {
        if (!valid) {
          totals.skipped++;
          continue;
        }
        try {
          const channelData = buildChannelData(ch);
          const result = await upsertImportedChannel(channelData);
          if (result === 'imported') totals.imported++;
          else if (result === 'updated') totals.updated++;
          else totals.skipped++;
        } catch {
          totals.failed++;
        }
      }
    } else {
      for (const ch of batch) {
        try {
          const channelData = buildChannelData(ch);
          const result = await upsertImportedChannel(channelData);
          if (result === 'imported') totals.imported++;
          else if (result === 'updated') totals.updated++;
          else totals.skipped++;
        } catch {
          totals.failed++;
        }
      }
    }

    const processed = Math.min(i + batchSize, deduped.length);
    process.stdout.write(`\r  Progress: ${processed}/${deduped.length} (Imported: ${totals.imported}, Updated: ${totals.updated})`);
  }

  console.log(''); // newline after progress
  return totals;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\nIMPORT: CloudTVE + bitsbb01 Scraped Sources');
  console.log('='.repeat(55));
  if (dryRun) console.log('[DRY RUN MODE - no DB writes]');
  if (validate) console.log(`[Validation enabled: timeout=${validationTimeout}ms, concurrency=${concurrency}]`);
  console.log(`Source: ${source}`);

  const summary = {};

  try {
    // CloudTVE
    if (source === 'all' || source === 'cloudtve') {
      const scraped = await scrapeCloudTVE();
      summary.cloudtve = await importCloudTVEChannels(scraped);
    }

    // bitsbb01
    if (source === 'all' || source === 'bitsbb01') {
      summary.bitsbb01 = await importBitsbb01();
    }

    // Final summary
    console.log('\n' + '='.repeat(55));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(55));

    let grandImported = 0;
    let grandUpdated = 0;
    let grandSkipped = 0;
    let grandFailed = 0;
    let grandTotal = 0;

    for (const [name, totals] of Object.entries(summary)) {
      console.log(`\n  ${name}:`);
      console.log(`    Total parsed:  ${totals.total}`);
      console.log(`    Imported:      ${totals.imported}`);
      console.log(`    Updated:       ${totals.updated}`);
      console.log(`    Skipped:       ${totals.skipped}`);
      console.log(`    Failed:        ${totals.failed}`);
      grandImported += totals.imported;
      grandUpdated += totals.updated;
      grandSkipped += totals.skipped;
      grandFailed += totals.failed;
      grandTotal += totals.total;
    }

    console.log(`\n  GRAND TOTAL:`);
    console.log(`    Parsed:   ${grandTotal}`);
    console.log(`    Imported: ${grandImported}`);
    console.log(`    Updated:  ${grandUpdated}`);
    console.log(`    Skipped:  ${grandSkipped}`);
    console.log(`    Failed:   ${grandFailed}`);

  } catch (err) {
    console.error(`\nFatal error: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }

  process.exit(0);
}

main();
