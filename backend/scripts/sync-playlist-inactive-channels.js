#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');
const { validateStream } = require('../src/services/channelImporter');

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    apply: false,
    timeout: 5000,
    concurrency: 20,
    limit: 0,
    folders: []
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--timeout' && args[i + 1]) {
      options.timeout = Number.parseInt(args[i + 1], 10) || options.timeout;
      i += 1;
      continue;
    }
    if (arg === '--concurrency' && args[i + 1]) {
      options.concurrency = Number.parseInt(args[i + 1], 10) || options.concurrency;
      i += 1;
      continue;
    }
    if (arg === '--limit' && args[i + 1]) {
      options.limit = Number.parseInt(args[i + 1], 10) || options.limit;
      i += 1;
      continue;
    }
    options.folders.push(arg);
  }

  return options;
}

function defaultFolders() {
  return [
    path.resolve(__dirname, '../../iptv/streams'),
    '/home/behar/playlists',
    '/home/behar/Downloads'
  ];
}

function listM3uFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /\.(m3u8?)$/i.test(name))
    .map((name) => path.join(dir, name))
    .filter((p) => fs.statSync(p).isFile());
}

function extractUrlsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('http://') || line.startsWith('https://'));
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

async function findInactiveByUrls(urls, chunkSize = 5000) {
  const rows = [];
  for (let i = 0; i < urls.length; i += chunkSize) {
    const part = urls.slice(i, i + chunkSize);
    const batch = await prisma.channel.findMany({
      where: {
        streamUrl: { in: part },
        isActive: false
      },
      select: {
        id: true,
        name: true,
        streamUrl: true,
        country: true,
        category: true
      }
    });
    rows.push(...batch);
  }
  return rows;
}

async function main() {
  const opts = parseArgs(process.argv);
  const folders = (opts.folders.length > 0 ? opts.folders : defaultFolders())
    .map((p) => path.resolve(p));

  console.log('=== Playlist Inactive Sync ===');
  console.log(`Mode: ${opts.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Timeout: ${opts.timeout}ms`);
  console.log(`Concurrency: ${opts.concurrency}`);
  console.log(`Limit: ${opts.limit > 0 ? opts.limit : 'none'}`);
  console.log('Folders:');
  folders.forEach((folder) => console.log(`  - ${folder}`));

  const allFiles = folders.flatMap(listM3uFiles);
  const allUrls = [];
  allFiles.forEach((filePath) => allUrls.push(...extractUrlsFromFile(filePath)));
  const uniqueUrls = Array.from(new Set(allUrls));

  console.log(`Playlist files found: ${allFiles.length}`);
  console.log(`Unique URLs found: ${uniqueUrls.length}`);

  if (uniqueUrls.length === 0) {
    console.log('No playlist URLs found.');
    return;
  }

  const inactiveRows = await findInactiveByUrls(uniqueUrls);

  const targets = opts.limit > 0 ? inactiveRows.slice(0, opts.limit) : inactiveRows;
  console.log(`Inactive channels matched in DB: ${inactiveRows.length}`);
  console.log(`Channels selected for validation: ${targets.length}`);

  if (targets.length === 0) {
    console.log('Nothing to sync.');
    return;
  }

  let checked = 0;
  const working = [];
  const failing = [];

  await runPool(targets, opts.concurrency, async (row) => {
    let isValid = false;
    try {
      isValid = await validateStream(row.streamUrl, opts.timeout);
    } catch {
      isValid = false;
    }

    if (isValid) working.push(row);
    else failing.push(row);

    checked += 1;
    if (checked % 25 === 0 || checked === targets.length) {
      console.log(
        `Progress: ${checked}/${targets.length} | working=${working.length} failing=${failing.length}`
      );
    }
  });

  let activated = 0;
  if (opts.apply && working.length > 0) {
    const batchSize = 300;
    for (let i = 0; i < working.length; i += batchSize) {
      const batch = working.slice(i, i + batchSize);
      await prisma.channel.updateMany({
        where: { id: { in: batch.map((row) => row.id) } },
        data: { isActive: true, updatedAt: new Date() }
      });
      activated += batch.length;
      console.log(`Activated: ${activated}/${working.length}`);
    }
  }

  console.log('\n=== Sync Summary ===');
  console.log(`Checked: ${targets.length}`);
  console.log(`Working now: ${working.length}`);
  console.log(`Failing now: ${failing.length}`);
  console.log(`Activated: ${activated}`);
  if (!opts.apply) {
    console.log('Dry-run only: no DB updates applied.');
  }

  const sample = working.slice(0, 20).map((row) => ({
    id: row.id,
    name: row.name,
    country: row.country,
    category: row.category
  }));
  if (sample.length > 0) {
    console.log('\nSample channels that can be activated:');
    sample.forEach((row) => {
      console.log(`  - ${row.name} (${row.country || 'Unknown'} / ${row.category || 'Uncategorized'})`);
    });
  }
}

main()
  .catch((error) => {
    console.error('Sync failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
