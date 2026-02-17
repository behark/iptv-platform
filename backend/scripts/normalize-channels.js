#!/usr/bin/env node

/**
 * Channel Normalization and Sorting Script
 *
 * 1. Normalizes category names (merges duplicates)
 * 2. Assigns unique sortOrder per channel using tiered country grouping:
 *    - Kosovo (XK):          10,000+
 *    - Albania (AL):         20,000+
 *    - Other Balkans:        30,000+ (BA, HR, RS, ME, MK, SI, BG, RO, GR)
 *    - World (alphabetical): 100,000+
 *    - International/Unknown: 900,000+
 *    Within each country: sorted by category priority (News first, Adult last),
 *    then alphabetically by name. Each channel gets a unique sortOrder.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Category normalization map (lowercase -> proper case)
const categoryMap = {
  'general': 'General',
  'undefined': 'General',
  'uncategorized': 'General',
  'news': 'News',
  'religious': 'Religious',
  'music': 'Music',
  'entertainment': 'Entertainment',
  'movies': 'Movies',
  'movie': 'Movies',
  'sports': 'Sports',
  'sport': 'Sports',
  'series': 'Series',
  'kids': 'Kids',
  'children': 'Kids',
  'legislative': 'Legislative',
  'education': 'Education',
  'educational': 'Education',
  'culture': 'Culture',
  'documentary': 'Documentary',
  'shop': 'Shopping',
  'shopping': 'Shopping',
  'lifestyle': 'Lifestyle',
  'comedy': 'Comedy',
  'business': 'Business',
  'classic': 'Classic',
  'classics': 'Classic',
  'animation': 'Animation',
  'outdoor': 'Outdoor',
  'travel': 'Travel',
  'cooking': 'Cooking',
  'food': 'Cooking',
  'science': 'Science',
  'weather': 'Weather',
  'xxx': 'Adult',
  'adult': 'Adult'
};

// Keywords to identify Kosovo channels
const kosovoKeywords = [
  'kosovo', 'kosova', 'kosovë', 'prishtina', 'pristina', 'prizren',
  'peja', 'gjakova', 'mitrovica', 'ferizaj', 'gjilan', 'rtk',
  'klan kosova', 't7', 'tribuna', 'kanal 10', 'kohavision', 'ktv',
  'rtv 21', 'tv21', 'art motion', 'art channel'
];

// Keywords to identify Albanian channels
const albanianKeywords = [
  'albania', 'albanian', 'shqip', 'shqiptar', 'shqipëri', 'tirana',
  'tiranë', 'top channel', 'klan tv', 'tv klan', 'vizion plus',
  'rtsh', 'tvsh', 'ora news', 'news 24', 'abc news', 'report tv',
  'a2 cnn', 'euronews albania', 'scan tv', 'syri tv', 'fax news',
  'agon channel', 'super sonic', 'bang bang', 'albuk', 'alb'
];

// Category priority for sorting within a country (lower = higher priority)
const categoryPriority = {
  'News': 1,
  'Sports': 2,
  'Entertainment': 3,
  'Movies': 4,
  'Series': 5,
  'Music': 6,
  'Kids': 7,
  'Documentary': 8,
  'Education': 9,
  'Culture': 10,
  'Religious': 11,
  'Lifestyle': 12,
  'Comedy': 13,
  'Business': 14,
  'Shopping': 15,
  'Legislative': 16,
  'Classic': 17,
  'General': 18,
  'Animation': 19,
  'Outdoor': 20,
  'Travel': 21,
  'Cooking': 22,
  'Science': 23,
  'Weather': 24,
  'Adult': 99
};

// Region tier bases
const TIER_KOSOVO = 10000;
const TIER_ALBANIA = 20000;
const TIER_BALKANS_BASE = 30000;
const TIER_WORLD_BASE = 100000;
const TIER_INTERNATIONAL = 900000;

// Balkan countries in display order
const balkanCountries = ['BA', 'HR', 'RS', 'ME', 'MK', 'SI', 'BG', 'RO', 'GR'];

// Space per country: 1000 values (enough for categories * alpha)
const COUNTRY_BLOCK_SIZE = 1000;

function normalizeCategory(category) {
  if (!category) return 'General';
  const lower = category.toLowerCase().trim();
  return categoryMap[lower] || category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

function isKosovoChannel(channel) {
  const searchText = `${channel.name} ${channel.country || ''} ${channel.language || ''}`.toLowerCase();
  return kosovoKeywords.some(kw => searchText.includes(kw)) ||
         (channel.country && channel.country.toUpperCase() === 'XK');
}

function isAlbanianChannel(channel) {
  const searchText = `${channel.name} ${channel.country || ''} ${channel.language || ''}`.toLowerCase();
  return albanianKeywords.some(kw => searchText.includes(kw)) ||
         (channel.country && channel.country.toUpperCase() === 'AL') ||
         (channel.language && channel.language.toLowerCase().includes('albanian'));
}

/**
 * Assigns a country tier base for sort ordering.
 * Returns { base, tierName } for logging.
 */
function getCountryTier(country) {
  const code = (country || '').toUpperCase();

  if (code === 'XK') return { base: TIER_KOSOVO, tierName: 'Kosovo' };
  if (code === 'AL') return { base: TIER_ALBANIA, tierName: 'Albania' };

  const balkanIdx = balkanCountries.indexOf(code);
  if (balkanIdx !== -1) {
    return { base: TIER_BALKANS_BASE + balkanIdx * COUNTRY_BLOCK_SIZE, tierName: 'Balkans' };
  }

  // INT, unknown, empty → last tier
  if (!code || code === 'INT' || code === 'UNDEFINED') {
    return { base: TIER_INTERNATIONAL, tierName: 'International' };
  }

  // All other countries: alphabetical by code
  return { base: TIER_WORLD_BASE, tierName: 'World' };
}

/**
 * Build unique sortOrder values for all channels.
 * Returns a Map of channelId -> sortOrder.
 */
function buildSortOrders(channels) {
  // Step 1: normalize categories and resolve country for each channel
  const enriched = channels.map(ch => {
    const normalizedCategory = normalizeCategory(ch.category);
    let effectiveCountry = (ch.country || '').toUpperCase();

    // Override country for Kosovo/Albanian detection by keywords
    if (effectiveCountry !== 'XK' && isKosovoChannel(ch)) {
      effectiveCountry = 'XK';
    } else if (effectiveCountry !== 'AL' && effectiveCountry !== 'XK' && isAlbanianChannel(ch)) {
      effectiveCountry = 'AL';
    }

    return { ...ch, normalizedCategory, effectiveCountry };
  });

  // Step 2: group by effective country
  const byCountry = new Map();
  for (const ch of enriched) {
    const key = ch.effectiveCountry || 'INT';
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key).push(ch);
  }

  // Step 3: sort countries into tier order
  // Collect all "World" countries and sort them alphabetically
  const worldCountries = [];
  for (const code of byCountry.keys()) {
    const { tierName } = getCountryTier(code);
    if (tierName === 'World') worldCountries.push(code);
  }
  worldCountries.sort();

  // Assign base offsets for world countries
  const worldBaseMap = new Map();
  for (let i = 0; i < worldCountries.length; i++) {
    worldBaseMap.set(worldCountries[i], TIER_WORLD_BASE + i * COUNTRY_BLOCK_SIZE);
  }

  // Step 4: assign sort orders
  const sortOrders = new Map();
  const catPriority = (cat) => categoryPriority[cat] || 50;

  for (const [countryCode, countryChannels] of byCountry) {
    let { base } = getCountryTier(countryCode);
    // For world countries, use their alphabetical offset
    if (worldBaseMap.has(countryCode)) {
      base = worldBaseMap.get(countryCode);
    }

    // Sort within country: category priority, then alphabetical by name
    countryChannels.sort((a, b) => {
      const catDiff = catPriority(a.normalizedCategory) - catPriority(b.normalizedCategory);
      if (catDiff !== 0) return catDiff;
      return (a.name || '').localeCompare(b.name || '');
    });

    for (let i = 0; i < countryChannels.length; i++) {
      sortOrders.set(countryChannels[i].id, base + i);
    }
  }

  return { sortOrders, enriched };
}

async function main() {
  console.log('Starting channel normalization...\n');

  const channels = await prisma.channel.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      country: true,
      language: true
    }
  });

  console.log(`Found ${channels.length} channels to process\n`);

  const { sortOrders, enriched } = buildSortOrders(channels);

  const stats = {
    kosova: 0,
    albanian: 0,
    balkans: 0,
    world: 0,
    international: 0,
    categoriesNormalized: 0,
    total: channels.length
  };

  const categoryStats = {};
  const countryStats = {};
  const batchSize = 500;

  // Prepare update data
  const updateData = enriched.map(ch => {
    const normalizedCategory = ch.normalizedCategory;
    const sortOrder = sortOrders.get(ch.id);
    const { tierName } = getCountryTier(ch.effectiveCountry);

    if (tierName === 'Kosovo') stats.kosova++;
    else if (tierName === 'Albania') stats.albanian++;
    else if (tierName === 'Balkans') stats.balkans++;
    else if (tierName === 'International') stats.international++;
    else stats.world++;

    if (ch.category !== normalizedCategory) stats.categoriesNormalized++;

    categoryStats[normalizedCategory] = (categoryStats[normalizedCategory] || 0) + 1;
    const cc = ch.effectiveCountry || 'INT';
    countryStats[cc] = (countryStats[cc] || 0) + 1;

    return { id: ch.id, category: normalizedCategory, sortOrder };
  });

  // Batch update
  for (let i = 0; i < updateData.length; i += batchSize) {
    const batch = updateData.slice(i, i + batchSize);
    const updates = batch.map(d =>
      prisma.channel.update({
        where: { id: d.id },
        data: { category: d.category, sortOrder: d.sortOrder }
      })
    );
    await prisma.$transaction(updates);
    console.log(`Processed ${Math.min(i + batchSize, updateData.length)}/${updateData.length} channels...`);
  }

  console.log('\n========== RESULTS ==========\n');
  console.log(`Total channels: ${stats.total}`);
  console.log(`Kosovo:         ${stats.kosova}`);
  console.log(`Albania:        ${stats.albanian}`);
  console.log(`Other Balkans:  ${stats.balkans}`);
  console.log(`World:          ${stats.world}`);
  console.log(`International:  ${stats.international}`);
  console.log(`Categories normalized: ${stats.categoriesNormalized}`);

  console.log('\nCategory distribution:');
  const sortedCategories = Object.entries(categoryStats)
    .sort((a, b) => (categoryPriority[a[0]] || 50) - (categoryPriority[b[0]] || 50));
  for (const [cat, count] of sortedCategories) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log('\nTop 20 countries by channel count:');
  const sortedCountries = Object.entries(countryStats).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [cc, count] of sortedCountries) {
    console.log(`  ${cc}: ${count}`);
  }

  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
