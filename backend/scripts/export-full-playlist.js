#!/usr/bin/env node
/**
 * Export all channels and VODs to M3U playlist file
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const OUTPUT_FILE = process.argv[2] || path.join(__dirname, '../../exports/iptv_full_playlist.m3u');

const sanitizeM3uValue = (value) => {
  if (!value || value === '\\N') return '';
  return String(value).replace(/"/g, "'").replace(/\r?\n/g, ' ').trim();
};

async function main() {
  console.log('='.repeat(60));
  console.log('Exporting channels and VODs to M3U playlist');
  console.log('='.repeat(60));

  // Fetch all active channels, prioritizing Kosovo and Albania
  const channels = await prisma.channel.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' }
    ]
  });

  console.log(`Found ${channels.length} active channels`);

  // Fetch all videos (VOD)
  const videos = await prisma.video.findMany({
    where: { isActive: true },
    orderBy: { title: 'asc' }
  });

  console.log(`Found ${videos.length} videos`);

  // Build M3U content — sortOrder already encodes country tiers + category + alpha
  let m3uContent = '#EXTM3U\n';

  // Count channels per country for summary
  const countryCount = {};
  for (const channel of channels) {
    const cc = channel.country || 'INT';
    countryCount[cc] = (countryCount[cc] || 0) + 1;
  }

  // Single loop — channels already sorted by sortOrder, name
  for (const channel of channels) {
    m3uContent += formatChannelEntry(channel);
  }

  // Add VOD section
  if (videos.length > 0) {
    m3uContent += '\n# VOD - Movies and Videos\n';
    for (const video of videos) {
      m3uContent += formatVideoEntry(video);
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, m3uContent, 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log('EXPORT COMPLETE!');
  console.log('='.repeat(60));
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log(`Total entries: ${channels.length + videos.length}`);
  console.log(`  - Channels: ${channels.length}`);
  console.log(`    - Kosovo (XK): ${countryCount['XK'] || 0}`);
  console.log(`    - Albania (AL): ${countryCount['AL'] || 0}`);
  const balkanCodes = ['BA', 'HR', 'RS', 'ME', 'MK', 'SI', 'BG', 'RO', 'GR'];
  const balkanTotal = balkanCodes.reduce((sum, c) => sum + (countryCount[c] || 0), 0);
  console.log(`    - Other Balkans: ${balkanTotal}`);
  const priorityCountries = new Set(['XK', 'AL', ...balkanCodes, 'INT']);
  const worldTotal = Object.entries(countryCount)
    .filter(([cc]) => !priorityCountries.has(cc))
    .reduce((sum, [, n]) => sum + n, 0);
  console.log(`    - World: ${worldTotal}`);
  console.log(`    - International/Unknown: ${countryCount['INT'] || 0}`);
  console.log(`  - Videos: ${videos.length}`);
}

function formatChannelEntry(channel) {
  if (!channel.streamUrl) return '';

  const name = sanitizeM3uValue(channel.name || 'Channel');
  const tvgId = sanitizeM3uValue(channel.epgId) || `${name.replace(/\s+/g, '')}.${channel.country || 'int'}`;

  const attrs = [];
  attrs.push(`tvg-id="${tvgId}"`);
  attrs.push(`tvg-name="${name}"`);

  const logo = sanitizeM3uValue(channel.logo);
  if (logo) attrs.push(`tvg-logo="${logo}"`);

  const groupTitle = sanitizeM3uValue(channel.category || 'General');
  attrs.push(`group-title="${groupTitle}"`);

  const country = sanitizeM3uValue(channel.country);
  if (country) attrs.push(`tvg-country="${country}"`);

  const language = sanitizeM3uValue(channel.language);
  if (language) attrs.push(`tvg-language="${language}"`);

  return `#EXTINF:-1 ${attrs.join(' ')},${name}\n${channel.streamUrl}\n`;
}

function formatVideoEntry(video) {
  if (!video.videoUrl) return '';

  const name = sanitizeM3uValue(video.title || 'Video');
  const tvgId = `vod-${video.id}`;
  const groupTitle = `VOD - ${sanitizeM3uValue(video.genre || 'Movies')}`;
  const duration = video.duration || -1;

  const attrs = [];
  attrs.push(`tvg-id="${tvgId}"`);
  attrs.push(`tvg-name="${name}"`);

  const logo = sanitizeM3uValue(video.thumbnail || video.posterUrl);
  if (logo) attrs.push(`tvg-logo="${logo}"`);

  attrs.push(`group-title="${groupTitle}"`);

  let displayName = name;
  if (video.year) displayName += ` (${video.year})`;

  return `#EXTINF:${duration} ${attrs.join(' ')},${displayName}\n${video.videoUrl}\n`;
}

main()
  .catch(error => {
    console.error('Export failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
