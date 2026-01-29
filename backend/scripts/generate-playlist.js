#!/usr/bin/env node
/**
 * Generate M3U Playlist File
 *
 * Usage:
 *   node scripts/generate-playlist.js                    # Full playlist
 *   node scripts/generate-playlist.js --prod             # Use production DB
 *   node scripts/generate-playlist.js --country=XK,AL    # Filter by country
 *   node scripts/generate-playlist.js --category=Sports  # Filter by category
 *   node scripts/generate-playlist.js --limit=1000       # Limit channels
 *   node scripts/generate-playlist.js --output=my.m3u    # Custom output file
 */

require('dotenv').config();

// Check for --prod flag to use production database
const useProd = process.argv.includes('--prod');
if (useProd) {
  process.env.DATABASE_URL = process.env.RENDER_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    }
  });
  return args;
};

const sanitizeM3uValue = (value) => {
  if (!value || value === '\\N') return '';
  return String(value).replace(/"/g, "'").replace(/\r?\n/g, ' ').trim();
};

const buildM3U = (channels, epgUrl) => {
  const header = epgUrl
    ? `#EXTM3U url-tvg="${epgUrl}" x-tvg-url="${epgUrl}"`
    : '#EXTM3U';
  const lines = [header];

  for (const channel of channels) {
    if (!channel.streamUrl) continue;

    const name = sanitizeM3uValue(channel.name || 'Channel');
    const attrs = [];

    const tvgId = sanitizeM3uValue(channel.epgId || channel.id);
    if (tvgId) attrs.push(`tvg-id="${tvgId}"`);
    if (name) attrs.push(`tvg-name="${name}"`);

    const logo = sanitizeM3uValue(channel.logo);
    if (logo) attrs.push(`tvg-logo="${logo}"`);

    const group = sanitizeM3uValue(channel.category || 'General');
    if (group) attrs.push(`group-title="${group}"`);

    const country = sanitizeM3uValue(channel.country);
    if (country) attrs.push(`tvg-country="${country}"`);

    const language = sanitizeM3uValue(channel.language);
    if (language) attrs.push(`tvg-language="${language}"`);

    const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
    lines.push(`#EXTINF:-1${attrText},${name}`);
    lines.push(channel.streamUrl);
  }

  return lines.join('\n');
};

const main = async () => {
  const args = parseArgs();

  console.log('🎬 IPTV Playlist Generator\n');
  console.log(`🗄️  Database: ${useProd ? 'PRODUCTION' : 'LOCAL'}`);

  // Build query filters
  const where = {
    isActive: true,
    isLive: true
  };

  if (args.country) {
    const countries = args.country.split(',').map(c => c.trim().toUpperCase());
    where.country = { in: countries };
    console.log(`📍 Filtering by countries: ${countries.join(', ')}`);
  }

  if (args.category) {
    const categories = args.category.split(',').map(c => c.trim());
    where.category = { in: categories };
    console.log(`📂 Filtering by categories: ${categories.join(', ')}`);
  }

  const limit = args.limit ? parseInt(args.limit, 10) : undefined;
  if (limit) {
    console.log(`🔢 Limiting to ${limit} channels`);
  }

  // Fetch channels
  console.log('\n⏳ Fetching channels from database...');

  const channels = await prisma.channel.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' }
    ],
    ...(limit ? { take: limit } : {})
  });

  console.log(`✅ Found ${channels.length} channels`);

  if (channels.length === 0) {
    console.log('⚠️  No channels found with the specified filters');
    process.exit(0);
  }

  // Generate M3U content
  console.log('\n📝 Generating M3U playlist...');
  const m3uContent = buildM3U(channels, null);

  // Determine output file
  const outputDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const defaultFilename = `playlist_${timestamp}.m3u`;
  const outputFile = args.output
    ? (path.isAbsolute(args.output) ? args.output : path.join(outputDir, args.output))
    : path.join(outputDir, defaultFilename);

  // Write file
  fs.writeFileSync(outputFile, m3uContent);

  const stats = fs.statSync(outputFile);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n✅ Playlist saved to: ${outputFile}`);
  console.log(`📊 File size: ${sizeMB} MB`);
  console.log(`📺 Total channels: ${channels.length}`);

  // Show category breakdown
  const categories = {};
  channels.forEach(ch => {
    const cat = ch.category || 'Uncategorized';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  console.log('\n📂 Categories breakdown:');
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} channels`);
    });

  if (Object.keys(categories).length > 10) {
    console.log(`   ... and ${Object.keys(categories).length - 10} more categories`);
  }

  console.log('\n🎉 Done! Upload this file to siptv.app/mylist/');
};

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
