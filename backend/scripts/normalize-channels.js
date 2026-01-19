#!/usr/bin/env node

/**
 * Channel Normalization and Sorting Script
 *
 * 1. Normalizes category names (merges duplicates)
 * 2. Assigns sortOrder based on priority:
 *    - Kosovo channels (sortOrder: 100-199)
 *    - Albanian channels (sortOrder: 200-299)
 *    - Movies (sortOrder: 300-399)
 *    - News (sortOrder: 400-499)
 *    - Sports (sortOrder: 500-599)
 *    - Entertainment (sortOrder: 600-699)
 *    - Music (sortOrder: 700-799)
 *    - Kids (sortOrder: 800-899)
 *    - Documentary (sortOrder: 900-999)
 *    - Others (sortOrder: 1000+)
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

// Category priority for sorting (lower = higher priority)
const categoryPriority = {
  'Movies': 300,
  'News': 400,
  'Sports': 500,
  'Entertainment': 600,
  'Music': 700,
  'Kids': 800,
  'Documentary': 900,
  'Series': 1000,
  'Education': 1100,
  'Culture': 1200,
  'Religious': 1300,
  'Lifestyle': 1400,
  'Comedy': 1500,
  'Business': 1600,
  'Shopping': 1700,
  'Legislative': 1800,
  'Classic': 1900,
  'General': 2000,
  'Animation': 2100,
  'Outdoor': 2200,
  'Travel': 2300,
  'Cooking': 2400,
  'Science': 2500,
  'Weather': 2600,
  'Adult': 9000
};

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

function calculateSortOrder(channel, normalizedCategory) {
  // Kosovo channels: 100-199
  if (isKosovoChannel(channel)) {
    return 100 + (categoryPriority[normalizedCategory] || 2000) / 100;
  }

  // Albanian channels: 200-299
  if (isAlbanianChannel(channel)) {
    return 200 + (categoryPriority[normalizedCategory] || 2000) / 100;
  }

  // Others: by category priority
  return categoryPriority[normalizedCategory] || 2000;
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

  const stats = {
    kosova: 0,
    albanian: 0,
    categoriesNormalized: 0,
    total: channels.length
  };

  const categoryStats = {};
  const batchSize = 500;

  for (let i = 0; i < channels.length; i += batchSize) {
    const batch = channels.slice(i, i + batchSize);
    const updates = [];

    for (const channel of batch) {
      const normalizedCategory = normalizeCategory(channel.category);
      const sortOrder = calculateSortOrder(channel, normalizedCategory);

      // Track stats
      if (isKosovoChannel(channel)) stats.kosova++;
      else if (isAlbanianChannel(channel)) stats.albanian++;

      if (channel.category !== normalizedCategory) {
        stats.categoriesNormalized++;
      }

      categoryStats[normalizedCategory] = (categoryStats[normalizedCategory] || 0) + 1;

      updates.push(
        prisma.channel.update({
          where: { id: channel.id },
          data: {
            category: normalizedCategory,
            sortOrder: sortOrder
          }
        })
      );
    }

    await prisma.$transaction(updates);
    console.log(`Processed ${Math.min(i + batchSize, channels.length)}/${channels.length} channels...`);
  }

  console.log('\n========== RESULTS ==========\n');
  console.log(`Total channels: ${stats.total}`);
  console.log(`Kosovo channels found: ${stats.kosova}`);
  console.log(`Albanian channels found: ${stats.albanian}`);
  console.log(`Categories normalized: ${stats.categoriesNormalized}`);
  console.log('\nCategory distribution:');

  const sortedCategories = Object.entries(categoryStats)
    .sort((a, b) => (categoryPriority[a[0]] || 2000) - (categoryPriority[b[0]] || 2000));

  for (const [cat, count] of sortedCategories) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
