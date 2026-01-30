#!/usr/bin/env node
/**
 * List inactive channels that come from a folder of M3U files, and optionally
 * re-check a sample of their streams to see how many are usable now.
 *
 * Usage:
 *   node scripts/list-inactive-from-folder.js "/path/to/iptv/streams"
 *   node scripts/list-inactive-from-folder.js "/path/to/iptv/streams" --recheck 50
 */

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const { validateStream } = require('../src/services/channelImporter');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const streamsDir = process.argv[2] || path.join(__dirname, '..', '..', 'Desktop', 'New Folder (4)', 'iptv', 'streams');
const recheckArg = process.argv.find((a) => a.startsWith('--recheck'));
const recheckLimit = recheckArg ? parseInt(process.argv[process.argv.indexOf(recheckArg) + 1], 10) : 0;

if (!fs.existsSync(streamsDir)) {
  console.error('Directory not found:', streamsDir);
  process.exit(1);
}

function extractUrlsFromM3u(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const urls = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      urls.push(trimmed);
    }
  }
  return urls;
}

function getAllUrlsFromDir(dir) {
  const allUrls = [];
  const files = fs.readdirSync(dir);
  for (const name of files) {
    if (!name.endsWith('.m3u')) continue;
    const fullPath = path.join(dir, name);
    if (!fs.statSync(fullPath).isFile()) continue;
    const urls = extractUrlsFromM3u(fullPath);
    allUrls.push(...urls);
  }
  return allUrls;
}

function truncate(s, maxLen = 70) {
  if (!s) return '';
  return s.length <= maxLen ? s : s.substring(0, maxLen) + '...';
}

async function main() {
  console.log('Folder:', streamsDir);
  const urlsFromFolder = getAllUrlsFromDir(streamsDir);
  const folderUrlSet = new Set(urlsFromFolder);

  const prisma = new PrismaClient();

  const inactiveFromFolder = await prisma.channel.findMany({
    where: {
      streamUrl: { in: [...folderUrlSet] },
      isActive: false
    },
    select: { id: true, name: true, category: true, country: true, streamUrl: true },
    orderBy: { name: 'asc' }
  });

  const total = inactiveFromFolder.length;
  console.log('\n--- Inactive channels from this folder ---');
  console.log('Total inactive (from folder) in DB:', total);

  const sampleSize = Math.min(30, total);
  if (total === 0) {
    console.log('No inactive channels from this folder.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nSample (first ' + sampleSize + ' by name):');
  console.log('-'.repeat(90));
  for (let i = 0; i < sampleSize; i++) {
    const ch = inactiveFromFolder[i];
    const name = (ch.name || '').padEnd(35).substring(0, 35);
    const cat = (ch.category || '-').padEnd(15).substring(0, 15);
    const country = (ch.country || '-').padEnd(6).substring(0, 6);
    const url = truncate(ch.streamUrl, 45);
    console.log(`${name}  ${cat}  ${country}  ${url}`);
  }
  console.log('-'.repeat(90));

  if (recheckLimit > 0 && total > 0) {
    console.log('\n--- Re-checking streams (sample of ' + recheckLimit + ') ---');
    const toCheck = inactiveFromFolder.slice(0, recheckLimit);
    let passed = 0;
    let failed = 0;
    for (let i = 0; i < toCheck.length; i++) {
      const ch = toCheck[i];
      try {
        const ok = await validateStream(ch.streamUrl, 6000);
        if (ok) passed++;
        else failed++;
      } catch {
        failed++;
      }
      if ((i + 1) % 10 === 0) console.log('  Checked ' + (i + 1) + '/' + toCheck.length + '...');
    }
    console.log('Result: ' + passed + ' working, ' + failed + ' still failing (out of ' + toCheck.length + ' re-checked).');
    if (toCheck.length < total) {
      console.log('(Re-checked only first ' + toCheck.length + '; run with --recheck ' + total + ' to check all.)');
    }
  } else if (total > 0) {
    console.log('\nTo re-check a sample of streams, run:');
    console.log('  node scripts/list-inactive-from-folder.js "' + streamsDir + '" --recheck 50');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
