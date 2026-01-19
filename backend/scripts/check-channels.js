#!/usr/bin/env node

const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
let renderUrl = process.env.RENDER_DATABASE_URL;
let checkStreams = true;
let cleanup = false;
let streamLimit = process.env.STREAM_CHECK_LIMIT
  ? Number.parseInt(process.env.STREAM_CHECK_LIMIT, 10)
  : null;
let streamOffset = process.env.STREAM_CHECK_OFFSET
  ? Number.parseInt(process.env.STREAM_CHECK_OFFSET, 10)
  : 0;
let concurrency = process.env.STREAM_CHECK_CONCURRENCY
  ? Number.parseInt(process.env.STREAM_CHECK_CONCURRENCY, 10)
  : 10;
let streamTimeoutMs = process.env.STREAM_CHECK_TIMEOUT_MS
  ? Number.parseInt(process.env.STREAM_CHECK_TIMEOUT_MS, 10)
  : 5000;
let recheckTimeoutMs = process.env.STREAM_CHECK_RECHECK_TIMEOUT_MS
  ? Number.parseInt(process.env.STREAM_CHECK_RECHECK_TIMEOUT_MS, 10)
  : 8000;
let activeOnly = false;
let outputPath = path.join(__dirname, '..', '..', 'logs', 'failed-streams-render.json');
let writeOutput = true;

function printUsage() {
  console.log('Usage: node scripts/check-channels.js [options] [render_database_url]');
  console.log('');
  console.log('Options:');
  console.log('  --render-url <url>     Render/Vercel Postgres URL (or set RENDER_DATABASE_URL)');
  console.log('  --no-stream-check      Skip stream accessibility checks');
  console.log('  --cleanup              Mark channels with failed streams as inactive on Render');
  console.log('  --limit <n>            Limit number of unique stream URLs to check');
  console.log('  --offset <n>           Skip first N unique stream URLs');
  console.log('  --concurrency <n>      Concurrent stream checks (default: 10)');
  console.log('  --timeout <ms>         Stream check timeout in ms (default: 5000)');
  console.log('  --recheck-timeout <ms> Recheck failed streams with a longer timeout (default: 8000)');
  console.log('  --no-recheck           Disable recheck pass');
  console.log('  --active-only          Only check streams for active Render channels');
  console.log('  --output <path>        Write failed stream report to JSON file');
  console.log('  --no-output            Skip writing failed stream report');
  console.log('  -h, --help             Show this help');
}

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--render-url') {
    renderUrl = args[i + 1];
    i += 1;
  } else if (arg === '--no-stream-check') {
    checkStreams = false;
  } else if (arg === '--cleanup') {
    cleanup = true;
  } else if (arg === '--limit') {
    streamLimit = Number.parseInt(args[i + 1], 10);
    i += 1;
  } else if (arg === '--concurrency') {
    concurrency = Number.parseInt(args[i + 1], 10);
    i += 1;
  } else if (arg === '--timeout') {
    streamTimeoutMs = Number.parseInt(args[i + 1], 10);
    i += 1;
  } else if (arg === '--offset') {
    streamOffset = Number.parseInt(args[i + 1], 10);
    i += 1;
  } else if (arg === '--recheck-timeout') {
    recheckTimeoutMs = Number.parseInt(args[i + 1], 10);
    i += 1;
  } else if (arg === '--no-recheck') {
    recheckTimeoutMs = 0;
  } else if (arg === '--active-only') {
    activeOnly = true;
  } else if (arg === '--output') {
    outputPath = args[i + 1];
    i += 1;
  } else if (arg === '--no-output') {
    writeOutput = false;
  } else if (arg === '--help' || arg === '-h') {
    printUsage();
    process.exit(0);
  } else if (!arg.startsWith('-') && !renderUrl) {
    renderUrl = arg;
  }
}

if (!renderUrl) {
  console.error('Missing Render/Vercel database URL.');
  printUsage();
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Ensure backend/.env exists or export DATABASE_URL.');
  process.exit(1);
}

const safeConcurrency = Number.isFinite(concurrency) ? Math.max(1, Math.min(concurrency, 50)) : 10;
const safeLimit = Number.isFinite(streamLimit) && streamLimit > 0 ? streamLimit : null;
const safeOffset = Number.isFinite(streamOffset) && streamOffset > 0 ? streamOffset : 0;
const safeTimeoutMs = Number.isFinite(streamTimeoutMs) && streamTimeoutMs > 0 ? streamTimeoutMs : 5000;
const safeRecheckTimeoutMs = Number.isFinite(recheckTimeoutMs) && recheckTimeoutMs > 0
  ? recheckTimeoutMs
  : 0;

const localPrisma = new PrismaClient();
const renderPrisma = new PrismaClient({
  datasources: { db: { url: renderUrl } }
});

async function isStreamReachable(url, timeoutMs = 5000) {
  const requestWithTimeout = async (config) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await axios({
        ...config,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    const response = await requestWithTimeout({
      method: 'HEAD',
      url,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      validateStatus: () => true
    });
    if (response.status >= 200 && response.status < 400) {
      return true;
    }
  } catch {
    // fall through to GET attempt
  }

  try {
    const response = await requestWithTimeout({
      method: 'GET',
      url,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Range: 'bytes=0-1'
      },
      validateStatus: () => true
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

async function checkStreamUrls(urls, options) {
  const total = urls.length;
  const failed = [];
  const failedSample = [];
  let ok = 0;
  let bad = 0;
  let index = 0;

  const workers = Array.from({ length: options.concurrency }, async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= total) {
        return;
      }

      const url = urls[currentIndex];
      const reachable = await isStreamReachable(url, options.timeoutMs);
      if (reachable) {
        ok += 1;
      } else {
        bad += 1;
        if (failed.length < options.failureSampleSize) {
          failedSample.push(url);
        }
        failed.push(url);
      }

      const checked = ok + bad;
      if (checked % options.progressEvery === 0 || checked === total) {
        console.log(`Checked ${checked}/${total} streams (ok: ${ok}, bad: ${bad})`);
      }
    }
  });

  await Promise.all(workers);

  return { ok, bad, failed, failedSample };
}

async function main() {
  console.log('Comparing local channels to Render/Vercel database...');

  const [localChannels, renderChannels] = await Promise.all([
    localPrisma.channel.findMany({
      select: { id: true, name: true, streamUrl: true, isActive: true }
    }),
    renderPrisma.channel.findMany({
      select: { id: true, name: true, streamUrl: true, isActive: true }
    })
  ]);

  const renderByStreamUrl = new Map();
  const renderById = new Set();

  for (const channel of renderChannels) {
    renderById.add(channel.id);
    const key = channel.streamUrl || '';
    if (!renderByStreamUrl.has(key)) {
      renderByStreamUrl.set(key, []);
    }
    renderByStreamUrl.get(key).push(channel);
  }

  const missingByStreamUrl = localChannels.filter(
    (channel) => channel.streamUrl && !renderByStreamUrl.has(channel.streamUrl)
  );
  const missingById = localChannels.filter((channel) => !renderById.has(channel.id));

  console.log(`Local channels: ${localChannels.length}`);
  console.log(`Render channels: ${renderChannels.length}`);
  console.log(`Missing on Render (by streamUrl): ${missingByStreamUrl.length}`);
  console.log(`Missing on Render (by id): ${missingById.length}`);

  if (missingByStreamUrl.length > 0) {
    console.log('Sample missing (by streamUrl):');
    missingByStreamUrl.slice(0, 20).forEach((channel) => {
      console.log(`- ${channel.name || 'Unknown'} | ${channel.streamUrl}`);
    });
    if (missingByStreamUrl.length > 20) {
      console.log(`...and ${missingByStreamUrl.length - 20} more`);
    }
  }

  const duplicateStreamUrls = [];
  for (const [url, entries] of renderByStreamUrl.entries()) {
    if (url && entries.length > 1) {
      duplicateStreamUrls.push({ url, count: entries.length });
    }
  }
  if (duplicateStreamUrls.length > 0) {
    console.log(`Duplicate stream URLs on Render: ${duplicateStreamUrls.length}`);
    duplicateStreamUrls.slice(0, 10).forEach((dup) => {
      console.log(`- ${dup.url} (x${dup.count})`);
    });
    if (duplicateStreamUrls.length > 10) {
      console.log(`...and ${duplicateStreamUrls.length - 10} more`);
    }
  }

  if (!checkStreams) {
    console.log('Stream accessibility check skipped.');
    return;
  }

  const renderChannelsForCheck = activeOnly
    ? renderChannels.filter((channel) => channel.isActive)
    : renderChannels;
  const uniqueStreamUrls = Array.from(
    new Set(renderChannelsForCheck.map((channel) => channel.streamUrl).filter(Boolean))
  );
  const offsetUrls = safeOffset ? uniqueStreamUrls.slice(safeOffset) : uniqueStreamUrls;
  const limitedUrls = safeLimit ? offsetUrls.slice(0, safeLimit) : offsetUrls;

  console.log(`Checking stream accessibility for ${limitedUrls.length} unique URLs...`);

  const result = await checkStreamUrls(limitedUrls, {
    concurrency: safeConcurrency,
    timeoutMs: safeTimeoutMs,
    progressEvery: 50,
    failureSampleSize: 25
  });

  console.log(`Stream check done. ok: ${result.ok}, bad: ${result.bad}`);
  let finalFailedUrls = result.failed;

  if (safeRecheckTimeoutMs > 0 && finalFailedUrls.length > 0) {
    console.log(`Rechecking ${finalFailedUrls.length} failed streams with ${safeRecheckTimeoutMs}ms timeout...`);
    const recheck = await checkStreamUrls(finalFailedUrls, {
      concurrency: safeConcurrency,
      timeoutMs: safeRecheckTimeoutMs,
      progressEvery: 50,
      failureSampleSize: 25
    });
    const recovered = finalFailedUrls.length - recheck.failed.length;
    finalFailedUrls = Array.from(new Set(recheck.failed));
    console.log(`Recheck done. recovered: ${recovered}, still bad: ${finalFailedUrls.length}`);
  }

  if (finalFailedUrls.length > 0) {
    console.log('Sample failed streams:');
    result.failedSample.forEach((url) => console.log(`- ${url}`));
  }

  if (writeOutput) {
    const reportDir = path.dirname(outputPath);
    fs.mkdirSync(reportDir, { recursive: true });

    const failedUrlSet = new Set(finalFailedUrls);
    const affectedChannels = renderChannels.filter((channel) => failedUrlSet.has(channel.streamUrl));
    const affectedActive = affectedChannels.filter((channel) => channel.isActive).length;

    const failedUrlCounts = {};
    for (const channel of affectedChannels) {
      const url = channel.streamUrl || '';
      failedUrlCounts[url] = (failedUrlCounts[url] || 0) + 1;
    }

    const renderedAt = new Date().toISOString();
    let renderHost = 'unknown';
    let renderDbName = 'unknown';
    try {
      const parsed = new URL(renderUrl);
      renderHost = parsed.hostname || renderHost;
      renderDbName = parsed.pathname.replace(/^\//, '') || renderDbName;
    } catch {
      // ignore parsing failures
    }

    const report = {
      generatedAt: renderedAt,
      renderHost,
      renderDbName,
      totals: {
        renderChannels: renderChannels.length,
        renderActiveChannels: renderChannels.filter((channel) => channel.isActive).length,
        checkedUrls: limitedUrls.length,
        failedUrls: finalFailedUrls.length,
        affectedChannels: affectedChannels.length,
        affectedActiveChannels: affectedActive
      },
      failedUrls: finalFailedUrls,
      failedUrlCounts,
      affectedChannels
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Wrote failed stream report to ${outputPath}`);

    if (cleanup && finalFailedUrls.length > 0) {
      console.log(`Deactivating ${affectedActive} active channels on Render...`);
      const urlsToDeactivate = Array.from(
        new Set(affectedChannels.filter((channel) => channel.isActive).map((channel) => channel.streamUrl))
      ).filter(Boolean);
      const chunkSize = 200;
      let updatedCount = 0;
      for (let i = 0; i < urlsToDeactivate.length; i += chunkSize) {
        const chunk = urlsToDeactivate.slice(i, i + chunkSize);
        const updateResult = await renderPrisma.channel.updateMany({
          where: {
            streamUrl: { in: chunk },
            isActive: true
          },
          data: {
            isActive: false,
            updatedAt: new Date()
          }
        });
        updatedCount += updateResult.count;
      }
      console.log(`Deactivated ${updatedCount} channels on Render.`);
    } else if (cleanup) {
      console.log('Cleanup requested but no failed URLs found after recheck.');
    }
  } else if (cleanup) {
    console.log('Cleanup requested but output is disabled; skipping deactivation for safety.');
  }
}

main()
  .catch((error) => {
    console.error('Check failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await localPrisma.$disconnect();
    await renderPrisma.$disconnect();
  });
