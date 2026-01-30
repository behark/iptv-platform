#!/usr/bin/env node
/**
 * Export all channels and VODs to M3U playlist file
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const OUTPUT_FILE = process.argv[2] || path.join(__dirname, '../../exports/iptv_full_playlist.m3u');

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

  // Build M3U content
  let m3uContent = '#EXTM3U\n';

  // Add channels first, grouped by country priority
  const kosovoChannels = channels.filter(c => c.country === 'XK');
  const albaniaChannels = channels.filter(c => c.country === 'AL');
  const otherChannels = channels.filter(c => c.country !== 'XK' && c.country !== 'AL');

  // Kosovo channels first
  for (const channel of kosovoChannels) {
    m3uContent += formatChannelEntry(channel);
  }

  // Albania channels second
  for (const channel of albaniaChannels) {
    m3uContent += formatChannelEntry(channel);
  }

  // Other channels
  for (const channel of otherChannels) {
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
  console.log(`    - Kosovo: ${kosovoChannels.length}`);
  console.log(`    - Albania: ${albaniaChannels.length}`);
  console.log(`    - Other: ${otherChannels.length}`);
  console.log(`  - Videos: ${videos.length}`);
}

function formatChannelEntry(channel) {
  const tvgId = channel.epgId || `${channel.name.replace(/\s+/g, '')}.${channel.country || 'int'}`;
  const tvgName = channel.name;
  const tvgLogo = channel.logo || '';
  const groupTitle = channel.category || 'General';
  const tvgCountry = channel.country || 'INT';
  const tvgLanguage = channel.language || 'en';

  let extinf = `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}"`;
  if (tvgLogo) extinf += ` tvg-logo="${tvgLogo}"`;
  extinf += ` group-title="${groupTitle}" tvg-country="${tvgCountry}" tvg-language="${tvgLanguage}",${tvgName}\n`;
  extinf += `${channel.streamUrl}\n`;

  return extinf;
}

function formatVideoEntry(video) {
  const tvgId = `vod-${video.id}`;
  const tvgName = video.title;
  const tvgLogo = video.thumbnail || video.posterUrl || '';
  const groupTitle = `VOD - ${video.genre || 'Movies'}`;
  const duration = video.duration || -1;

  let extinf = `#EXTINF:${duration} tvg-id="${tvgId}" tvg-name="${tvgName}"`;
  if (tvgLogo) extinf += ` tvg-logo="${tvgLogo}"`;
  extinf += ` group-title="${groupTitle}",${tvgName}`;
  if (video.year) extinf += ` (${video.year})`;
  extinf += '\n';
  extinf += `${video.videoUrl}\n`;

  return extinf;
}

main()
  .catch(error => {
    console.error('Export failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
