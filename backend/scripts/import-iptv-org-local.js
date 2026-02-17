#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const {
    parseM3U,
    validateStream,
    buildChannelData,
    upsertImportedChannel,
    dedupeChannelsByStreamUrl
} = require('../src/services/channelImporter');

const prisma = new PrismaClient();

const DEFAULT_DIR = '/home/behar/Desktop/New Folder (4)/iptv/streams/';
const PROVIDER_SUFFIXES = [
    'pluto', 'plutotv', 'samsung', 'stingray', 'morescreens', 'nexgen',
    'local', 'rakuten', 'amagi', 'roku', 'tubi', 'plex', 'xumo', 'stirr',
    'vizio', 'sofast', 'firetv', 'distro', 'frequency', 'klowdtv',
    'glewedtv', 'moveonjoy', 'canelatv', 'cineversetv', 'tcl', 'tvpass',
    'ssh101', 'wfmz', '30a', '3abn', 'abcnews', 'cbsn', 'pbs',
    'bfm', 'fashiontv', 'groupecanalplus', 'groupem6', 'persiana',
    'sportstribal', 'bbc', 'xploretv', 'smashplus', 'opencaster',
    'mediateka', 'multimedios', 'yowi',
    '112114', 'cctv', 'cgtn', 'yeslivetv', 'happywatch99',
    'bonustv', 'catcast', 'mylifeisgood', 'ntv', 'rt', 'smotrim',
    'televizor24', 'tvbricks', 'tvteleport', 'zabava',
    'lenz', 'telewebion', 'wnslive', 'gem', 'onetv',
    'v2hcdn', 'premiumfree', 'freevisiontv'
];

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        dir: DEFAULT_DIR,
        validate: true,
        includeProviders: false,
        country: null,
        batchSize: 50,
        timeout: 5000,
        concurrency: 10,
        dryRun: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--dir':
                opts.dir = args[++i];
                break;
            case '--validate':
                opts.validate = true;
                break;
            case '--no-validate':
                opts.validate = false;
                break;
            case '--include-providers':
                opts.includeProviders = true;
                break;
            case '--country':
                opts.country = args[++i]?.toLowerCase();
                break;
            case '--batch-size':
                opts.batchSize = parseInt(args[++i], 10) || 50;
                break;
            case '--timeout':
                opts.timeout = parseInt(args[++i], 10) || 5000;
                break;
            case '--concurrency':
                opts.concurrency = parseInt(args[++i], 10) || 10;
                break;
            case '--dry-run':
                opts.dryRun = true;
                break;
            case '--help':
                printUsage();
                process.exit(0);
            default:
                console.error(`Unknown flag: ${args[i]}`);
                printUsage();
                process.exit(1);
        }
    }

    return opts;
}

function printUsage() {
    console.log(`
Usage: node import-iptv-org-local.js [options]

Import channels from a local iptv-org streams/ directory with
concurrent health checking and provider filtering.

Options:
  --dir <path>          Path to streams/ directory (default: ${DEFAULT_DIR})
  --validate            Enable stream health checking (default)
  --no-validate         Skip stream health checking
  --include-providers   Also import provider-specific files (pluto, samsung, etc.)
  --country <code>      Only import a single country (e.g., --country al)
  --batch-size <n>      DB upsert batch size (default: 50)
  --timeout <ms>        Stream validation timeout (default: 5000)
  --concurrency <n>     Parallel stream checks (default: 10)
  --dry-run             Parse and validate but don't write to DB
  --help                Show this help

Examples:
  node import-iptv-org-local.js --dry-run
  node import-iptv-org-local.js --no-validate
  node import-iptv-org-local.js --country al --concurrency 20
  node import-iptv-org-local.js --include-providers --no-validate
`);
}

function isProviderFile(filename) {
    const base = path.basename(filename, '.m3u');
    if (!base.includes('_')) return false;
    const suffix = base.split('_').slice(1).join('_');
    return PROVIDER_SUFFIXES.includes(suffix);
}

function deriveCountryCode(filename) {
    const base = path.basename(filename, '.m3u');
    // Standard files: "al.m3u" -> "AL", "unsorted.m3u" -> null
    const code = base.split('_')[0];
    if (code.length === 2) return code.toUpperCase();
    return null;
}

async function loadExistingUrls() {
    const rows = await prisma.channel.findMany({
        where: { isActive: true },
        select: { streamUrl: true }
    });
    return new Set(rows.map(r => r.streamUrl.trim()));
}

async function validateConcurrent(channels, concurrency, timeout) {
    const results = new Array(channels.length);
    let nextIdx = 0;
    let validated = 0;
    const total = channels.length;
    const startTime = Date.now();

    async function worker() {
        while (nextIdx < total) {
            const idx = nextIdx++;
            const ch = channels[idx];
            try {
                results[idx] = await validateStream(ch.streamUrl, timeout);
            } catch {
                results[idx] = false;
            }
            validated++;
            if (validated % 25 === 0 || validated === total) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
                const rate = (validated / elapsed * 60).toFixed(0);
                process.stdout.write(
                    `\r  Validating: ${validated}/${total} (${rate}/min, ${elapsed}s elapsed)`
                );
            }
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, total); i++) {
        workers.push(worker());
    }
    await Promise.all(workers);
    process.stdout.write('\n');

    return results;
}

async function main() {
    const opts = parseArgs();

    console.log('=== iptv-org Local Import ===\n');
    console.log(`  Directory:    ${opts.dir}`);
    console.log(`  Validate:     ${opts.validate}`);
    console.log(`  Concurrency:  ${opts.concurrency}`);
    console.log(`  Timeout:      ${opts.timeout}ms`);
    console.log(`  Dry run:      ${opts.dryRun}`);
    console.log(`  Providers:    ${opts.includeProviders ? 'included' : 'skipped'}`);
    if (opts.country) console.log(`  Country:      ${opts.country.toUpperCase()}`);
    console.log('');

    // 1. Discover M3U files
    const allFiles = (await fs.readdir(opts.dir))
        .filter(f => f.endsWith('.m3u'))
        .sort();

    let files = allFiles;

    if (opts.country) {
        files = files.filter(f => {
            const base = path.basename(f, '.m3u');
            return base === opts.country || base.startsWith(opts.country + '_');
        });
        if (!opts.includeProviders) {
            files = files.filter(f => !isProviderFile(f));
        }
    } else if (!opts.includeProviders) {
        files = files.filter(f => !isProviderFile(f));
    }

    const skippedCount = allFiles.length - files.length;
    console.log(`Found ${allFiles.length} M3U files, importing ${files.length} (skipping ${skippedCount} provider files)\n`);

    if (files.length === 0) {
        console.log('No files to import.');
        return;
    }

    // 2. Parse all M3U files
    console.log('--- Phase 1: Parsing M3U files ---\n');
    let allChannels = [];
    const perFileStats = [];

    for (const file of files) {
        const filePath = path.join(opts.dir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseM3U(content);
        const countryCode = deriveCountryCode(file);

        // Tag channels with country from filename if they don't have one
        for (const ch of parsed) {
            if (countryCode && (!ch.country || ch.country === 'INT')) {
                ch.country = countryCode;
            }
        }

        perFileStats.push({ file, count: parsed.length, country: countryCode });
        allChannels.push(...parsed);

        if (parsed.length > 0) {
            process.stdout.write(`  ${file}: ${parsed.length} channels\n`);
        }
    }

    console.log(`\nTotal parsed: ${allChannels.length} channels from ${files.length} files`);

    // 3. Deduplicate by stream URL
    const deduped = dedupeChannelsByStreamUrl(allChannels);
    const dupeCount = allChannels.length - deduped.length;
    if (dupeCount > 0) {
        console.log(`Removed ${dupeCount} duplicate stream URLs`);
    }
    console.log(`Unique channels: ${deduped.length}\n`);

    // 4. Pre-filter against existing DB
    console.log('--- Phase 2: Pre-filtering against DB ---\n');
    const existingUrls = await loadExistingUrls();
    console.log(`  Existing active channels in DB: ${existingUrls.size}`);

    const newChannels = deduped.filter(ch => !existingUrls.has(ch.streamUrl.trim()));
    const alreadyExist = deduped.length - newChannels.length;
    console.log(`  Already in DB: ${alreadyExist}`);
    console.log(`  New channels to process: ${newChannels.length}\n`);

    if (newChannels.length === 0) {
        console.log('No new channels to import. Everything is already in the DB.');
        return;
    }

    // 5. Validate streams (if enabled)
    let channelsToImport = newChannels;
    let validationFailed = 0;

    if (opts.validate) {
        console.log(`--- Phase 3: Validating ${newChannels.length} streams (concurrency=${opts.concurrency}) ---\n`);

        const results = await validateConcurrent(newChannels, opts.concurrency, opts.timeout);
        channelsToImport = [];
        for (let i = 0; i < newChannels.length; i++) {
            if (results[i]) {
                channelsToImport.push(newChannels[i]);
            } else {
                validationFailed++;
            }
        }

        console.log(`  Alive: ${channelsToImport.length}`);
        console.log(`  Dead/unreachable: ${validationFailed}\n`);
    }

    // 6. Import to DB
    if (opts.dryRun) {
        console.log('--- DRY RUN: skipping DB writes ---\n');
        console.log(`Would import ${channelsToImport.length} channels\n`);
    } else {
        console.log(`--- Phase ${opts.validate ? '4' : '3'}: Importing ${channelsToImport.length} channels ---\n`);

        let imported = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;

        for (let i = 0; i < channelsToImport.length; i++) {
            const ch = channelsToImport[i];
            try {
                const channelData = buildChannelData(ch, {
                    country: ch.country || null
                });
                const result = await upsertImportedChannel(channelData);
                if (result === 'imported') imported++;
                else if (result === 'updated') updated++;
                else skipped++;
            } catch (err) {
                failed++;
                if (process.env.DEBUG) {
                    console.error(`  Failed: ${ch.name} - ${err.message}`);
                }
            }

            if ((i + 1) % 50 === 0 || i + 1 === channelsToImport.length) {
                process.stdout.write(
                    `\r  Progress: ${i + 1}/${channelsToImport.length} | Imported: ${imported} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`
                );
            }
        }

        console.log('\n');

        // 7. Summary
        console.log('=== Import Summary ===\n');
        console.log(`  Files scanned:       ${files.length}`);
        console.log(`  Provider files skip: ${skippedCount}`);
        console.log(`  Total parsed:        ${allChannels.length}`);
        console.log(`  After dedup:         ${deduped.length}`);
        console.log(`  Already in DB:       ${alreadyExist}`);
        console.log(`  New candidates:      ${newChannels.length}`);
        if (opts.validate) {
            console.log(`  Validation failed:   ${validationFailed}`);
        }
        console.log(`  ---`);
        console.log(`  Imported (new):      ${imported}`);
        console.log(`  Updated (enriched):  ${updated}`);
        console.log(`  Skipped (no change): ${skipped}`);
        console.log(`  Failed (DB error):   ${failed}`);
    }
}

main()
    .catch(err => {
        console.error('\nFatal error:', err.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
