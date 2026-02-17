#!/usr/bin/env node

/**
 * Fix Channel Metadata Inconsistencies
 *
 * Fix A: Corrupted channel names (user-agent strings embedded in name field)
 *   - Detects names containing 'group-title='
 *   - Extracts real channel name from the tail of the corrupted string
 *
 * Fix B: Semicolon-separated categories → single primary category
 *   - Detects categories containing ';'
 *   - Takes the first value, normalizes casing via categoryMap
 *
 * Usage:
 *   node scripts/fix-channel-metadata.js            # Dry-run (preview changes)
 *   node scripts/fix-channel-metadata.js --apply     # Apply changes to DB
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BATCH_SIZE = 300;
const apply = process.argv.includes('--apply');

// Reused from normalize-channels.js
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

function normalizeCategory(raw) {
  if (!raw) return 'General';
  const lower = raw.toLowerCase().trim();
  return categoryMap[lower] || raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * Extract the real channel name from a corrupted name string.
 * Pattern 1: ...group-title="...",<REAL NAME>  or  ...group-title='...',<REAL NAME>
 * Pattern 2: ...referer='...',<REAL NAME>  (user-agent + referer variant)
 */
function extractRealName(corruptedName) {
  // Match group-title='...' or referer='...' followed by comma and the real name
  const match = corruptedName.match(/(?:group-title|referer)=["'][^"']*["'],\s*(.+)$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Fallback: take everything after the last comma if it looks like a name
  const lastComma = corruptedName.lastIndexOf(',');
  if (lastComma !== -1) {
    const candidate = corruptedName.substring(lastComma + 1).trim();
    if (candidate.length > 1 && !candidate.includes('=')) {
      return candidate;
    }
  }
  return null;
}

async function fixCorruptedNames() {
  const channels = await prisma.channel.findMany({
    where: {
      OR: [
        { name: { contains: 'group-title=' } },
        { name: { contains: 'Safari/537' } }
      ]
    },
    select: { id: true, name: true }
  });

  console.log(`\n--- Fix A: Corrupted Channel Names ---`);
  console.log(`Found ${channels.length} channels with corrupted names\n`);

  const fixes = [];
  for (const ch of channels) {
    const newName = extractRealName(ch.name);
    if (newName && newName !== ch.name) {
      fixes.push({ id: ch.id, oldName: ch.name, newName });
    }
  }

  console.log(`Fixable: ${fixes.length} / ${channels.length}`);

  // Print samples (up to 10)
  const samples = fixes.slice(0, 10);
  for (const fix of samples) {
    const truncOld = fix.oldName.length > 80 ? fix.oldName.substring(fix.oldName.length - 80) : fix.oldName;
    console.log(`  "${truncOld}" => "${fix.newName}"`);
  }
  if (fixes.length > 10) {
    console.log(`  ... and ${fixes.length - 10} more`);
  }

  return fixes;
}

async function fixSemicolonCategories() {
  const channels = await prisma.channel.findMany({
    where: {
      category: { contains: ';' }
    },
    select: { id: true, category: true }
  });

  console.log(`\n--- Fix B: Semicolon-Separated Categories ---`);
  console.log(`Found ${channels.length} channels with semicolon categories\n`);

  const fixes = [];
  for (const ch of channels) {
    const primary = ch.category.split(';')[0].trim();
    const normalized = normalizeCategory(primary);
    if (normalized !== ch.category) {
      fixes.push({ id: ch.id, oldCategory: ch.category, newCategory: normalized });
    }
  }

  console.log(`Fixable: ${fixes.length} / ${channels.length}`);

  // Print category mapping summary
  const mappings = {};
  for (const fix of fixes) {
    const key = `${fix.oldCategory} => ${fix.newCategory}`;
    mappings[key] = (mappings[key] || 0) + 1;
  }
  const sorted = Object.entries(mappings).sort((a, b) => b[1] - a[1]);
  for (const [mapping, count] of sorted.slice(0, 15)) {
    console.log(`  ${mapping} (${count})`);
  }
  if (sorted.length > 15) {
    console.log(`  ... and ${sorted.length - 15} more mappings`);
  }

  return fixes;
}

async function applyFixes(nameFixes, categoryFixes) {
  const allUpdates = [];

  // Merge fixes by id (a channel could have both a name and category fix)
  const updateMap = new Map();
  for (const fix of nameFixes) {
    updateMap.set(fix.id, { ...(updateMap.get(fix.id) || {}), name: fix.newName });
  }
  for (const fix of categoryFixes) {
    updateMap.set(fix.id, { ...(updateMap.get(fix.id) || {}), category: fix.newCategory });
  }

  for (const [id, data] of updateMap) {
    allUpdates.push({ id, data });
  }

  console.log(`\nApplying ${allUpdates.length} updates in batches of ${BATCH_SIZE}...`);

  let applied = 0;
  for (let i = 0; i < allUpdates.length; i += BATCH_SIZE) {
    const batch = allUpdates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(({ id, data }) =>
        prisma.channel.update({
          where: { id },
          data
        })
      )
    );
    applied += batch.length;
    console.log(`Applied ${applied}/${allUpdates.length}`);
  }

  return applied;
}

async function main() {
  console.log('=== Fix Channel Metadata ===');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  const nameFixes = await fixCorruptedNames();
  const categoryFixes = await fixSemicolonCategories();

  const totalFixes = new Set([...nameFixes.map(f => f.id), ...categoryFixes.map(f => f.id)]).size;

  console.log('\n--- Summary ---');
  console.log(`Name fixes: ${nameFixes.length}`);
  console.log(`Category fixes: ${categoryFixes.length}`);
  console.log(`Total channels affected: ${totalFixes}`);

  if (apply) {
    if (totalFixes === 0) {
      console.log('\nNo fixes to apply.');
    } else {
      const applied = await applyFixes(nameFixes, categoryFixes);
      console.log(`\nDone! Applied ${applied} updates.`);
    }
  } else {
    console.log('\nDry-run complete. Re-run with --apply to write changes.');
  }
}

main()
  .catch((error) => {
    console.error('Fix failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
