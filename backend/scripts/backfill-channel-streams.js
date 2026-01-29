#!/usr/bin/env node

const prisma = require('../src/lib/prisma');
const { normalizeStreamInfo } = require('../src/utils/stream');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : null;

const normalizeStreamType = (channel, info) => {
  if (info.streamType && info.streamType !== 'UNKNOWN') {
    return info.streamType;
  }
  return channel.streamType || 'UNKNOWN';
};

const normalizeFileExt = (channel, info, streamType) => {
  if (streamType !== 'FILE') return null;
  return info.fileExt || channel.fileExt || null;
};

async function main() {
  const query = {
    select: { id: true, streamUrl: true, streamType: true, fileExt: true },
    orderBy: { createdAt: 'asc' }
  };
  if (Number.isFinite(limit)) {
    query.take = limit;
  }

  const channels = await prisma.channel.findMany(query);

  let updated = 0;
  let skipped = 0;

  for (const channel of channels) {
    const info = normalizeStreamInfo(channel.streamUrl);
    const nextStreamType = normalizeStreamType(channel, info);
    const nextFileExt = normalizeFileExt(channel, info, nextStreamType);

    if (nextStreamType === channel.streamType && nextFileExt === channel.fileExt) {
      skipped++;
      continue;
    }

    updated++;

    if (!dryRun) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: {
          streamType: nextStreamType,
          fileExt: nextFileExt
        }
      });
    }
  }

  console.log(`Channels scanned: ${channels.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${skipped}`);
  if (dryRun) {
    console.log('Dry run enabled: no changes written.');
  }
}

main()
  .catch(error => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
