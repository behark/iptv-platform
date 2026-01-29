/**
 * Direct API Importers
 * Import channels from streaming services via iptv-org streams
 *
 * Supported services:
 * - Pluto TV (via iptv-org)
 * - Samsung TV Plus (via iptv-org)
 * - Plex Live TV (via iptv-org)
 * - Roku Channel (via iptv-org)
 *
 * Note: Original APIs (mjh.nz) were taken down due to DMCA.
 * Now uses iptv-org streams which aggregate these services.
 */

const axios = require('axios');
const prisma = require('../lib/prisma');
const { parseM3U } = require('./playlistParsers');

// iptv-org stream URLs
const IPTV_ORG_STREAMS = {
    pluto_us: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_pluto.m3u',
    pluto_ca: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca_pluto.m3u',
    pluto_uk: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk_pluto.m3u',
    samsung_all: 'https://iptv-org.github.io/iptv/index.m3u', // Filter for samsung
    plex_all: 'https://iptv-org.github.io/iptv/index.m3u', // Filter for plex
    roku_all: 'https://iptv-org.github.io/iptv/index.m3u', // Filter for roku
};

/**
 * Base class for API importers
 */
class BaseApiImporter {
    constructor(name) {
        this.name = name;
        this.channels = [];
    }

    async fetch() {
        throw new Error('fetch() must be implemented');
    }

    async fetchM3U(url, filter = null) {
        console.log(`Fetching from: ${url}`);

        const response = await axios.get(url, {
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0 IPTV-Importer/1.0' }
        });

        let channels = parseM3U(response.data);

        // Apply filter if specified
        if (filter) {
            channels = channels.filter(ch =>
                ch.streamUrl?.toLowerCase().includes(filter.toLowerCase()) ||
                ch.name?.toLowerCase().includes(filter.toLowerCase())
            );
        }

        return channels;
    }

    async import(options = {}) {
        const { dryRun = false, limit = null } = options;

        console.log(`\n📺 ${this.name} Importer`);
        console.log('─'.repeat(50));

        await this.fetch();

        let channels = this.channels;
        if (limit) {
            channels = channels.slice(0, limit);
        }

        console.log(`Found ${channels.length} channels`);

        if (dryRun) {
            console.log('\n🔍 DRY RUN - No changes will be made');
            return { total: channels.length, imported: 0, skipped: 0, dryRun: true };
        }

        let imported = 0;
        let skipped = 0;
        let updated = 0;

        for (const channel of channels) {
            try {
                const existing = await prisma.channel.findFirst({
                    where: { streamUrl: channel.streamUrl }
                });

                if (existing) {
                    // Update logo/metadata if we have better data
                    const updates = {};
                    if (channel.logo && !existing.logo) updates.logo = channel.logo;
                    if (channel.description && !existing.description) updates.description = channel.description;
                    if (!existing.fileExt && channel.fileExt) updates.fileExt = channel.fileExt;

                    if (Object.keys(updates).length > 0) {
                        await prisma.channel.update({
                            where: { id: existing.id },
                            data: updates
                        });
                        updated++;
                    }
                    skipped++;
                    continue;
                }

                await prisma.channel.create({
                    data: {
                        name: (channel.name || 'Unknown').substring(0, 255),
                        description: (channel.description || '').substring(0, 255),
                        logo: channel.logo,
                        streamUrl: channel.streamUrl,
                        streamType: channel.streamType || 'HLS',
                        fileExt: channel.fileExt || null,
                        category: channel.category || 'Entertainment',
                        country: channel.country || 'US',
                        language: channel.language || 'en',
                        epgId: channel.epgId,
                        isActive: true,
                        isLive: true
                    }
                });

                imported++;
            } catch (error) {
                skipped++;
            }
        }

        console.log(`\n✅ Complete: ${imported} imported, ${skipped} skipped, ${updated} updated`);

        return { total: channels.length, imported, skipped, updated };
    }
}

/**
 * Pluto TV Importer
 * Uses iptv-org streams for Pluto TV channels
 */
class PlutoTVImporter extends BaseApiImporter {
    constructor(region = 'us') {
        super('Pluto TV');
        this.region = region.toLowerCase();
    }

    async fetch() {
        console.log(`Fetching Pluto TV channels for region: ${this.region.toUpperCase()}`);

        // Try region-specific stream first
        const regionUrl = IPTV_ORG_STREAMS[`pluto_${this.region}`];

        if (regionUrl) {
            try {
                this.channels = await this.fetchM3U(regionUrl);
                // Set country based on region
                this.channels.forEach(ch => {
                    ch.country = this.region.toUpperCase();
                    ch.category = ch.category || 'Entertainment';
                });
            } catch (error) {
                console.log(`Region ${this.region} not available, falling back to main index...`);
                // Fallback to main index filtered for pluto
                this.channels = await this.fetchM3U(
                    'https://iptv-org.github.io/iptv/index.m3u',
                    'pluto.tv'
                );
            }
        } else {
            // Filter main index for pluto channels
            this.channels = await this.fetchM3U(
                'https://iptv-org.github.io/iptv/index.m3u',
                'pluto.tv'
            );
        }

        console.log(`Loaded ${this.channels.length} channels`);
    }

    static getRegions() {
        return ['us', 'ca', 'uk'];
    }
}

/**
 * Samsung TV Plus Importer
 * Filters iptv-org streams for Samsung TV Plus channels
 */
class SamsungTVPlusImporter extends BaseApiImporter {
    constructor(region = 'us') {
        super('Samsung TV Plus');
        this.region = region.toLowerCase();
    }

    async fetch() {
        console.log(`Fetching Samsung TV Plus channels...`);

        // Samsung TV Plus channels are in iptv-org, filter by 'samsung' or 'amagi'
        this.channels = await this.fetchM3U(
            'https://iptv-org.github.io/iptv/index.m3u',
            'samsung'
        );

        // Also get amagi streams (used by Samsung TV Plus)
        const amagiChannels = await this.fetchM3U(
            'https://iptv-org.github.io/iptv/index.m3u',
            'amagi.tv'
        );

        // Merge and dedupe
        const urls = new Set(this.channels.map(ch => ch.streamUrl));
        for (const ch of amagiChannels) {
            if (!urls.has(ch.streamUrl)) {
                this.channels.push(ch);
            }
        }

        console.log(`Loaded ${this.channels.length} channels`);
    }

    static getRegions() {
        return ['us', 'uk', 'de', 'au'];
    }
}

/**
 * Xumo Importer
 * Filters iptv-org streams for Xumo channels
 */
class XumoImporter extends BaseApiImporter {
    constructor() {
        super('Xumo');
    }

    async fetch() {
        console.log('Fetching Xumo channels...');

        this.channels = await this.fetchM3U(
            'https://iptv-org.github.io/iptv/index.m3u',
            'xumo'
        );

        console.log(`Loaded ${this.channels.length} channels`);
    }

    static getRegions() {
        return ['us'];
    }
}

/**
 * Plex Live TV Importer (Free channels)
 * Filters iptv-org streams for Plex channels
 */
class PlexImporter extends BaseApiImporter {
    constructor() {
        super('Plex Live TV');
    }

    async fetch() {
        console.log('Fetching Plex Live TV channels...');

        // Plex uses frequency.stream CDN
        this.channels = await this.fetchM3U(
            'https://iptv-org.github.io/iptv/index.m3u',
            'frequency.stream'
        );

        // Also search for 'plex' in names/URLs
        const plexChannels = await this.fetchM3U(
            'https://iptv-org.github.io/iptv/index.m3u',
            'plex'
        );

        // Merge and dedupe
        const urls = new Set(this.channels.map(ch => ch.streamUrl));
        for (const ch of plexChannels) {
            if (!urls.has(ch.streamUrl)) {
                this.channels.push(ch);
            }
        }

        console.log(`Loaded ${this.channels.length} channels`);
    }
}

/**
 * Stirr Importer
 * Note: Stirr streams were mostly removed due to DMCA
 */
class StirrImporter extends BaseApiImporter {
    constructor() {
        super('Stirr');
    }

    async fetch() {
        console.log('Fetching Stirr channels...');

        this.channels = await this.fetchM3U(
            'https://iptv-org.github.io/iptv/index.m3u',
            'stirr'
        );

        console.log(`Loaded ${this.channels.length} channels`);
        if (this.channels.length === 0) {
            console.log('Note: Stirr streams may have been removed due to DMCA');
        }
    }
}

/**
 * Roku Channel Importer
 * Filters iptv-org streams for Roku channels
 */
class RokuImporter extends BaseApiImporter {
    constructor() {
        super('Roku Channel');
    }

    async fetch() {
        console.log('Fetching Roku channels...');

        this.channels = await this.fetchM3U(
            'https://iptv-org.github.io/iptv/index.m3u',
            'roku'
        );

        console.log(`Loaded ${this.channels.length} channels`);
        if (this.channels.length === 0) {
            console.log('Note: Roku streams may have been removed due to DMCA');
        }
    }
}

/**
 * Import from all services
 */
async function importAll(options = {}) {
    const { regions = ['us'], dryRun = false } = options;

    const results = {};

    // Pluto TV
    for (const region of regions) {
        if (PlutoTVImporter.getRegions().includes(region)) {
            const importer = new PlutoTVImporter(region);
            results[`pluto_${region}`] = await importer.import({ dryRun });
        }
    }

    // Samsung TV Plus
    for (const region of regions) {
        if (SamsungTVPlusImporter.getRegions().includes(region)) {
            const importer = new SamsungTVPlusImporter(region);
            results[`samsung_${region}`] = await importer.import({ dryRun });
        }
    }

    // Xumo
    const xumo = new XumoImporter('us');
    results['xumo'] = await xumo.import({ dryRun });

    // Plex
    const plex = new PlexImporter();
    results['plex'] = await plex.import({ dryRun });

    // Stirr
    const stirr = new StirrImporter();
    results['stirr'] = await stirr.import({ dryRun });

    // Roku
    const roku = new RokuImporter();
    results['roku'] = await roku.import({ dryRun });

    return results;
}

module.exports = {
    BaseApiImporter,
    PlutoTVImporter,
    SamsungTVPlusImporter,
    XumoImporter,
    PlexImporter,
    StirrImporter,
    RokuImporter,
    importAll
};
