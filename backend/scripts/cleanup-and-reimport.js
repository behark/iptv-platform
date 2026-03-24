/**
 * Cleanup & Reimport Script
 * - Deduplicates by stream URL
 * - Removes unwanted countries (India, China, SE Asia, niche Africa)
 * - Removes Legislative + Shopping groups
 * - Preserves ALL Albanian/Kosovo channels
 * - Imports clean playlist into Neon DB
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');

const PLAYLIST_PATH = path.join(__dirname, '../../exports/playlist_2026-01-21.m3u');

const REMOVE_COUNTRIES = new Set([
  // Asia
  'IN', 'CN', 'KR', 'TH', 'MN', 'KH', 'VN', 'JP', 'MY', 'TW',
  'LA', 'MM', 'LK', 'BD', 'HK', 'MO', 'NP', 'BN', 'PH', 'SG',
  'MV', 'ID',
  // Africa (niche)
  'NG', 'CI', 'UG', 'CM', 'TG', 'BF', 'GN', 'RW', 'TZ', 'MZ',
  'AO', 'ET', 'GH', 'KE', 'SD', 'ML', 'CD', 'CG', 'ZA', 'NA',
  'ZW', 'CV', 'MG', 'KM', 'EH', 'MR', 'ER', 'TD', 'SN', 'NE', 'BJ',
]);

const REMOVE_GROUPS = new Set(['Legislative', 'Shopping']);

// ALWAYS keep these countries no matter what
const ALWAYS_KEEP = new Set([
  'AL', 'XK', 'MK', 'RS', 'HR', 'BA', 'ME',
]);

function parseM3U(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const channels = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF')) continue;

    const url = lines[i + 1]?.trim();
    if (!url || url.startsWith('#') || !url.startsWith('http')) continue;

    const name = line.includes(',') ? line.split(',').slice(1).join(',').trim() : '';
    const country = line.match(/tvg-country="([^"]*)"/)?.[1] || '';
    const group = line.match(/group-title="([^"]*)"/)?.[1] || '';
    const logo = line.match(/tvg-logo="([^"]*)"/)?.[1] || '';
    const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] || '';
    const tvgName = line.match(/tvg-name="([^"]*)"/)?.[1] || '';
    const language = line.match(/tvg-language="([^"]*)"/)?.[1] || '';

    channels.push({ name, url, country, group, logo, tvgId, tvgName, language, extinf: line });
  }

  return channels;
}

function cleanChannels(channels) {
  const seenUrls = new Set();
  const kept = [];
  const stats = { dupes: 0, country: 0, group: 0, kept: 0 };

  for (const ch of channels) {
    // Always keep Albanian/Kosovo
    const forceKeep = ALWAYS_KEEP.has(ch.country);

    // Remove duplicate URLs
    if (seenUrls.has(ch.url)) {
      stats.dupes++;
      continue;
    }
    seenUrls.add(ch.url);

    // Remove by country (unless force keep)
    if (!forceKeep && REMOVE_COUNTRIES.has(ch.country)) {
      stats.country++;
      continue;
    }

    // Remove by group (unless force keep)
    if (!forceKeep && REMOVE_GROUPS.has(ch.group)) {
      stats.group++;
      continue;
    }

    kept.push(ch);
    stats.kept++;
  }

  return { kept, stats };
}

function mapToCategory(group) {
  const map = {
    'News': 'NEWS', 'Entertainment': 'ENTERTAINMENT', 'Music': 'MUSIC',
    'Movies': 'MOVIES', 'Sports': 'SPORTS', 'Series': 'SERIES',
    'Kids': 'KIDS', 'Documentary': 'DOCUMENTARY', 'Education': 'EDUCATION',
    'Culture': 'CULTURE', 'Comedy': 'COMEDY', 'Animation': 'ANIMATION',
    'Religious': 'RELIGIOUS', 'Business': 'BUSINESS', 'Cooking': 'COOKING',
    'Travel': 'TRAVEL', 'Lifestyle': 'LIFESTYLE', 'Family': 'FAMILY',
    'Classic': 'CLASSIC', 'Science': 'SCIENCE', 'Weather': 'WEATHER',
    'Automotive': 'AUTOMOTIVE', 'Outdoor': 'OUTDOOR',
  };
  return map[group] || null;
}

async function importToDb(channels) {
  console.log('\n📦 Starting database import...');
  console.log('⚠️  Clearing existing channels...');

  await prisma.channel.deleteMany({});
  console.log('✅ Cleared existing channels');

  const BATCH = 500;
  let imported = 0;

  for (let i = 0; i < channels.length; i += BATCH) {
    const batch = channels.slice(i, i + BATCH);

    await prisma.channel.createMany({
      data: batch.map(ch => ({
        name: ch.name || ch.tvgName || 'Unknown',
        streamUrl: ch.url,
        logo: ch.logo || null,
        country: ch.country || null,
        language: ch.language || null,
        category: mapToCategory(ch.group),
        epgId: ch.tvgId || null,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    imported += batch.length;
    process.stdout.write(`\r  Imported ${imported}/${channels.length} channels...`);
  }

  console.log(`\n✅ Import complete: ${imported} channels`);
}

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');

  console.log('🎬 IPTV Playlist Cleanup & Reimport');
  console.log(`   Playlist: ${PLAYLIST_PATH}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no DB changes)' : 'LIVE IMPORT'}\n`);

  console.log('📖 Parsing playlist...');
  const channels = parseM3U(PLAYLIST_PATH);
  console.log(`   Found ${channels.length.toLocaleString()} channels`);

  console.log('🧹 Cleaning...');
  const { kept, stats } = cleanChannels(channels);

  console.log('\n📊 CLEANUP RESULTS:');
  console.log(`   Original:           ${channels.length.toLocaleString()}`);
  console.log(`   Removed duplicates: ${stats.dupes.toLocaleString()}`);
  console.log(`   Removed by country: ${stats.country.toLocaleString()}`);
  console.log(`   Removed by group:   ${stats.group.toLocaleString()}`);
  console.log(`   ─────────────────────────────`);
  console.log(`   FINAL RESULT:       ${stats.kept.toLocaleString()} channels`);

  // Show AL/XK breakdown
  const xk = kept.filter(c => c.country === 'XK');
  const al = kept.filter(c => c.country === 'AL');
  console.log(`\n   🇽🇰 Kosovo (XK):    ${xk.length} channels`);
  xk.forEach(c => console.log(`      ✓ ${c.name}`));
  console.log(`\n   🇦🇱 Albania (AL):   ${al.length} channels`);
  al.forEach(c => console.log(`      ✓ ${c.name}`));

  if (DRY_RUN) {
    console.log('\n✋ Dry run — no changes made to database.');
    console.log('   Run without --dry-run to import.\n');
    return;
  }

  console.log('\n⚠️  This will DELETE all existing channels and reimport.');
  console.log('   Starting in 3 seconds... (Ctrl+C to cancel)');
  await new Promise(r => setTimeout(r, 3000));

  await importToDb(kept);

  const count = await prisma.channel.count();
  console.log(`\n🎉 Done! Database now has ${count.toLocaleString()} channels.`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
