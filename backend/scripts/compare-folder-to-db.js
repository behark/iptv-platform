#!/usr/bin/env node
/**
 * Compare channels from a folder of M3U files to the local database.
 * Usage: node scripts/compare-folder-to-db.js "/path/to/iptv/streams"
 */

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const streamsDir = process.argv[2] || path.join(__dirname, '..', '..', 'Desktop', 'New Folder (4)', 'iptv', 'streams');

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

async function main() {
  console.log('Reading M3U files from:', streamsDir);
  const urlsFromFolder = getAllUrlsFromDir(streamsDir);
  const uniqueUrls = [...new Set(urlsFromFolder)];

  console.log('');
  console.log('--- Folder summary ---');
  console.log('Total channel entries (with duplicates):', urlsFromFolder.length);
  console.log('Unique stream URLs:', uniqueUrls.length);

  const prisma = new PrismaClient();

  const channelsByUrl = await prisma.channel.findMany({
    where: { streamUrl: { in: uniqueUrls } },
    select: { streamUrl: true, isActive: true }
  });

  const foundUrls = new Set(channelsByUrl.map((c) => c.streamUrl));
  const foundActive = new Set(channelsByUrl.filter((c) => c.isActive).map((c) => c.streamUrl));
  const missingUrls = uniqueUrls.filter((u) => !foundUrls.has(u));

  console.log('');
  console.log('--- Database comparison ---');
  console.log('Channels from folder found in DB (any status):', foundUrls.size);
  console.log('Channels from folder found in DB (active):', foundActive.size);
  console.log('Channels from folder NOT in DB:', missingUrls.length);

  const missingActive = uniqueUrls.filter((u) => foundUrls.has(u) && !foundActive.has(u));
  if (missingActive.length > 0) {
    console.log('Channels in DB but inactive:', missingActive.length);
  }

  const pctFound = uniqueUrls.length ? ((foundUrls.size / uniqueUrls.length) * 100).toFixed(1) : 0;
  const pctActive = uniqueUrls.length ? ((foundActive.size / uniqueUrls.length) * 100).toFixed(1) : 0;
  console.log('');
  console.log('--- Coverage ---');
  console.log(`${pctFound}% of unique folder URLs exist in DB`);
  console.log(`${pctActive}% of unique folder URLs are active in DB`);

  if (missingUrls.length > 0 && missingUrls.length <= 20) {
    console.log('');
    console.log('Sample missing URLs (first 20):');
    missingUrls.slice(0, 20).forEach((u) => console.log('  ', u.substring(0, 80) + (u.length > 80 ? '...' : '')));
  } else if (missingUrls.length > 20) {
    console.log('');
    console.log('Sample missing URLs (first 10):');
    missingUrls.slice(0, 10).forEach((u) => console.log('  ', u.substring(0, 80) + (u.length > 80 ? '...' : '')));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
