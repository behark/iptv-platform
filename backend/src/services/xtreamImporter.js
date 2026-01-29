/**
 * Xtream Codes API Importer
 * Import channels from Xtream Codes compatible IPTV providers
 *
 * Supports:
 * - Live TV streams
 * - VOD (Movies)
 * - Series
 * - EPG data
 */

const axios = require('axios');
const prisma = require('../lib/prisma');
const { parseXtreamCodes, parseXtreamVOD, parseXtreamSeries } = require('./playlistParsers');

class XtreamImporter {
    constructor(serverUrl, username, password) {
        // Clean up server URL
        this.serverUrl = serverUrl.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.serverInfo = null;
        this.categories = {
            live: [],
            vod: [],
            series: []
        };
    }

    /**
     * Build API URL
     */
    buildUrl(action, params = {}) {
        const url = new URL(`${this.serverUrl}/player_api.php`);
        url.searchParams.set('username', this.username);
        url.searchParams.set('password', this.password);
        url.searchParams.set('action', action);

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        return url.toString();
    }

    /**
     * Make API request
     */
    async request(action, params = {}) {
        const url = this.buildUrl(action, params);

        try {
            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 IPTV-Platform/1.0'
                }
            });

            return response.data;
        } catch (error) {
            throw new Error(`Xtream API error: ${error.message}`);
        }
    }

    /**
     * Authenticate and get server info
     */
    async authenticate() {
        console.log('🔐 Authenticating with Xtream server...');

        const data = await this.request('');

        if (!data || !data.user_info) {
            throw new Error('Invalid credentials or server response');
        }

        this.serverInfo = {
            url: data.server_info?.url || this.serverUrl,
            port: data.server_info?.port,
            httpsPort: data.server_info?.https_port,
            protocol: data.server_info?.server_protocol || 'http',
            timezone: data.server_info?.timezone,
            username: data.user_info?.username,
            status: data.user_info?.status,
            expDate: data.user_info?.exp_date,
            isTrial: data.user_info?.is_trial === '1',
            activeCons: data.user_info?.active_cons,
            maxConnections: data.user_info?.max_connections,
            allowedOutputFormats: data.user_info?.allowed_output_formats || ['m3u8', 'ts']
        };

        console.log(`✅ Authenticated as: ${this.serverInfo.username}`);
        console.log(`   Status: ${this.serverInfo.status}`);
        console.log(`   Expires: ${this.serverInfo.expDate ? new Date(this.serverInfo.expDate * 1000).toLocaleDateString() : 'N/A'}`);

        return this.serverInfo;
    }

    /**
     * Get live TV categories
     */
    async getLiveCategories() {
        console.log('📁 Fetching live TV categories...');
        const data = await this.request('get_live_categories');
        this.categories.live = data || [];
        console.log(`   Found ${this.categories.live.length} categories`);
        return this.categories.live;
    }

    /**
     * Get VOD categories
     */
    async getVODCategories() {
        console.log('📁 Fetching VOD categories...');
        const data = await this.request('get_vod_categories');
        this.categories.vod = data || [];
        console.log(`   Found ${this.categories.vod.length} categories`);
        return this.categories.vod;
    }

    /**
     * Get series categories
     */
    async getSeriesCategories() {
        console.log('📁 Fetching series categories...');
        const data = await this.request('get_series_categories');
        this.categories.series = data || [];
        console.log(`   Found ${this.categories.series.length} categories`);
        return this.categories.series;
    }

    /**
     * Get all live streams
     */
    async getLiveStreams(categoryId = null) {
        const params = categoryId ? { category_id: categoryId } : {};
        const data = await this.request('get_live_streams', params);
        return parseXtreamCodes(data || [], this.serverUrl, this.username, this.password);
    }

    /**
     * Get all VOD streams
     */
    async getVODStreams(categoryId = null) {
        const params = categoryId ? { category_id: categoryId } : {};
        const data = await this.request('get_vod_streams', params);
        return parseXtreamVOD(data || [], this.serverUrl, this.username, this.password);
    }

    /**
     * Get all series
     */
    async getSeries(categoryId = null) {
        const params = categoryId ? { category_id: categoryId } : {};
        const data = await this.request('get_series', params);
        return parseXtreamSeries(data || [], this.serverUrl, this.username, this.password);
    }

    /**
     * Get series episodes
     */
    async getSeriesInfo(seriesId) {
        const data = await this.request('get_series_info', { series_id: seriesId });
        return data;
    }

    /**
     * Get EPG for channels
     */
    async getEPG(streamId = null) {
        const params = streamId ? { stream_id: streamId } : {};
        const data = await this.request('get_simple_data_table', params);
        return data;
    }

    /**
     * Import live channels to database
     */
    async importLiveChannels(options = {}) {
        const { categoryId = null, categoryFilter = null, limit = null } = options;

        console.log('\n📺 Importing live channels...');

        // Get categories first
        await this.getLiveCategories();

        let channels = await this.getLiveStreams(categoryId);

        // Filter by category name if specified
        if (categoryFilter) {
            const filterLower = categoryFilter.toLowerCase();
            channels = channels.filter(ch =>
                ch.category?.toLowerCase().includes(filterLower)
            );
        }

        // Apply limit
        if (limit && limit > 0) {
            channels = channels.slice(0, limit);
        }

        console.log(`   Processing ${channels.length} channels...`);

        let imported = 0;
        let skipped = 0;
        let updated = 0;

        for (const channel of channels) {
            try {
                const existing = await prisma.channel.findFirst({
                    where: { streamUrl: channel.streamUrl }
                });

                if (existing) {
                    // Update if we have better data
                    if (channel.logo && !existing.logo) {
                        await prisma.channel.update({
                            where: { id: existing.id },
                            data: { logo: channel.logo }
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
                        streamType: channel.streamType,
                        category: channel.category || 'Live TV',
                        country: channel.country || 'INT',
                        language: channel.language || 'en',
                        epgId: channel.epgId,
                        isActive: true,
                        isLive: true
                    }
                });

                imported++;

                if (imported % 100 === 0) {
                    process.stdout.write(`\r   Imported: ${imported}`);
                }
            } catch (error) {
                skipped++;
            }
        }

        console.log(`\n✅ Import complete: ${imported} imported, ${skipped} skipped, ${updated} updated`);

        return { imported, skipped, updated, total: channels.length };
    }

    /**
     * Import VOD to database
     */
    async importVOD(options = {}) {
        const { categoryId = null, limit = null } = options;

        console.log('\n🎬 Importing VOD content...');

        let items = await this.getVODStreams(categoryId);

        if (limit && limit > 0) {
            items = items.slice(0, limit);
        }

        console.log(`   Processing ${items.length} items...`);

        let imported = 0;
        let skipped = 0;

        for (const item of items) {
            try {
                const existing = await prisma.vODContent.findFirst({
                    where: { streamUrl: item.streamUrl }
                });

                if (existing) {
                    skipped++;
                    continue;
                }

                await prisma.vODContent.create({
                    data: {
                        title: (item.name || 'Unknown').substring(0, 255),
                        description: (item.description || '').substring(0, 1000),
                        thumbnail: item.logo,
                        streamUrl: item.streamUrl,
                        category: item.category || 'Movies',
                        year: item.year ? parseInt(item.year) : null,
                        duration: item.duration,
                        rating: item.rating,
                        isActive: true
                    }
                });

                imported++;
            } catch (error) {
                skipped++;
            }
        }

        console.log(`✅ VOD Import complete: ${imported} imported, ${skipped} skipped`);

        return { imported, skipped, total: items.length };
    }

    /**
     * Get full info for display
     */
    async getFullInfo() {
        await this.authenticate();
        await this.getLiveCategories();
        await this.getVODCategories();
        await this.getSeriesCategories();

        // Get sample counts
        const liveCount = (await this.getLiveStreams()).length;
        const vodCount = (await this.getVODStreams()).length;
        const seriesCount = (await this.getSeries()).length;

        return {
            server: this.serverInfo,
            categories: this.categories,
            counts: {
                live: liveCount,
                vod: vodCount,
                series: seriesCount
            }
        };
    }
}

/**
 * Parse Xtream URL into components
 */
function parseXtreamUrl(url) {
    // Support various URL formats:
    // http://server.com:port/get.php?username=X&password=Y&type=m3u_plus
    // http://server.com:port/player_api.php?username=X&password=Y
    // http://server.com:port (with separate credentials)

    try {
        const parsed = new URL(url);
        const username = parsed.searchParams.get('username');
        const password = parsed.searchParams.get('password');

        // Get base server URL
        const serverUrl = `${parsed.protocol}//${parsed.host}`;

        return { serverUrl, username, password };
    } catch {
        return null;
    }
}

/**
 * Create importer from URL
 */
function createFromUrl(url) {
    const parsed = parseXtreamUrl(url);
    if (!parsed || !parsed.username || !parsed.password) {
        throw new Error('Invalid Xtream URL. Expected format: http://server:port/get.php?username=X&password=Y');
    }

    return new XtreamImporter(parsed.serverUrl, parsed.username, parsed.password);
}

module.exports = {
    XtreamImporter,
    parseXtreamUrl,
    createFromUrl
};
