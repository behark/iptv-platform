const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FREE_SOURCES = [
    {
        name: 'All Channels',
        url: 'https://iptv-org.github.io/iptv/index.m3u',
        priority: 1
    },
    {
        name: 'By Country',
        url: 'https://iptv-org.github.io/iptv/index.country.m3u',
        priority: 2
    },
    {
        name: 'By Category',
        url: 'https://iptv-org.github.io/iptv/index.category.m3u',
        priority: 3
    }
];

const CATEGORY_SOURCES = {
    news: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    sports: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    entertainment: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u',
    movies: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    music: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    kids: 'https://iptv-org.github.io/iptv/categories/kids.m3u',
    documentary: 'https://iptv-org.github.io/iptv/categories/documentary.m3u',
    lifestyle: 'https://iptv-org.github.io/iptv/categories/lifestyle.m3u',
    cooking: 'https://iptv-org.github.io/iptv/categories/cooking.m3u',
    travel: 'https://iptv-org.github.io/iptv/categories/travel.m3u'
};

const COUNTRY_SOURCES = {
    us: 'https://iptv-org.github.io/iptv/countries/us.m3u',
    uk: 'https://iptv-org.github.io/iptv/countries/uk.m3u',
    de: 'https://iptv-org.github.io/iptv/countries/de.m3u',
    fr: 'https://iptv-org.github.io/iptv/countries/fr.m3u',
    es: 'https://iptv-org.github.io/iptv/countries/es.m3u',
    it: 'https://iptv-org.github.io/iptv/countries/it.m3u',
    in: 'https://iptv-org.github.io/iptv/countries/in.m3u',
    br: 'https://iptv-org.github.io/iptv/countries/br.m3u',
    mx: 'https://iptv-org.github.io/iptv/countries/mx.m3u',
    ca: 'https://iptv-org.github.io/iptv/countries/ca.m3u',
    au: 'https://iptv-org.github.io/iptv/countries/au.m3u',
    jp: 'https://iptv-org.github.io/iptv/countries/jp.m3u',
    kr: 'https://iptv-org.github.io/iptv/countries/kr.m3u',
    ru: 'https://iptv-org.github.io/iptv/countries/ru.m3u',
    tr: 'https://iptv-org.github.io/iptv/countries/tr.m3u',
    ae: 'https://iptv-org.github.io/iptv/countries/ae.m3u',
    sa: 'https://iptv-org.github.io/iptv/countries/sa.m3u',
    eg: 'https://iptv-org.github.io/iptv/countries/eg.m3u'
};

function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            const attrs = {};

            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);
            const tvgCountryMatch = line.match(/tvg-country="([^"]*)"/);
            const tvgLanguageMatch = line.match(/tvg-language="([^"]*)"/);

            const nameMatch = line.match(/,(.+)$/);

            currentChannel = {
                epgId: tvgIdMatch ? tvgIdMatch[1] : null,
                name: tvgNameMatch ? tvgNameMatch[1] : (nameMatch ? nameMatch[1].trim() : 'Unknown'),
                logo: tvgLogoMatch ? tvgLogoMatch[1] : null,
                category: groupMatch ? groupMatch[1] : 'Uncategorized',
                country: tvgCountryMatch ? tvgCountryMatch[1].toUpperCase() : null,
                language: tvgLanguageMatch ? tvgLanguageMatch[1].toLowerCase() : null,
                description: nameMatch ? nameMatch[1].trim() : ''
            };
        } else if ((line.startsWith('http://') || line.startsWith('https://')) && currentChannel) {
            currentChannel.streamUrl = line;
            currentChannel.streamType = detectStreamType(line);
            channels.push(currentChannel);
            currentChannel = null;
        }
    }

    return channels;
}

function detectStreamType(url) {
    if (url.includes('.m3u8')) return 'HLS';
    if (url.includes('.mpd')) return 'DASH';
    if (url.includes('.ts')) return 'MPEG_TS';
    if (url.includes('rtmp://')) return 'RTMP';
    return 'HLS';
}

async function validateStream(url, timeout = 5000) {
    try {
        const response = await axios.head(url, {
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.status === 200 || response.status === 302;
    } catch {
        return false;
    }
}

async function importFromUrl(url, options = {}) {
    const {
        validateStreams = false,
        category = null,
        country = null,
        batchSize = 100,
        onProgress = null
    } = options;

    console.log(`📥 Fetching playlist from: ${url}`);

    try {
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const channels = parseM3U(response.data);
        console.log(`📺 Found ${channels.length} channels in playlist`);

        let imported = 0;
        let skipped = 0;
        let failed = 0;

        for (let i = 0; i < channels.length; i += batchSize) {
            const batch = channels.slice(i, i + batchSize);

            for (const channel of batch) {
                try {
                    if (validateStreams) {
                        const isValid = await validateStream(channel.streamUrl);
                        if (!isValid) {
                            skipped++;
                            continue;
                        }
                    }

                    const channelData = {
                        name: channel.name.substring(0, 255),
                        description: (channel.description || channel.name || '').substring(0, 255),
                        logo: channel.logo,
                        streamUrl: channel.streamUrl,
                        streamType: channel.streamType,
                        category: category || channel.category || 'Uncategorized',
                        country: country || channel.country || 'INT',
                        language: channel.language || 'en',
                        epgId: channel.epgId,
                        isActive: true,
                        isLive: true
                    };

                    const existingChannel = await prisma.channel.findFirst({
                        where: { streamUrl: channel.streamUrl }
                    });

                    if (existingChannel) {
                        await prisma.channel.update({
                            where: { id: existingChannel.id },
                            data: {
                                name: channelData.name,
                                logo: channelData.logo,
                                category: channelData.category,
                                updatedAt: new Date()
                            }
                        });
                    } else {
                        await prisma.channel.create({ data: channelData });
                    }

                    imported++;
                } catch (error) {
                    failed++;
                    if (process.env.DEBUG) {
                        console.error(`Failed: ${channel.name} - ${error.message}`);
                    }
                }
            }

            if (onProgress) {
                onProgress({
                    processed: Math.min(i + batchSize, channels.length),
                    total: channels.length,
                    imported,
                    skipped,
                    failed
                });
            }

            console.log(`Progress: ${Math.min(i + batchSize, channels.length)}/${channels.length} (Imported: ${imported})`);
        }

        return { imported, skipped, failed, total: channels.length };
    } catch (error) {
        console.error(`Error importing from ${url}:`, error.message);
        throw error;
    }
}

async function importByCategory(categoryName, options = {}) {
    const url = CATEGORY_SOURCES[categoryName.toLowerCase()];
    if (!url) {
        throw new Error(`Unknown category: ${categoryName}. Available: ${Object.keys(CATEGORY_SOURCES).join(', ')}`);
    }
    return importFromUrl(url, { ...options, category: categoryName });
}

async function importByCountry(countryCode, options = {}) {
    const url = COUNTRY_SOURCES[countryCode.toLowerCase()];
    if (!url) {
        throw new Error(`Unknown country: ${countryCode}. Available: ${Object.keys(COUNTRY_SOURCES).join(', ')}`);
    }
    return importFromUrl(url, { ...options, country: countryCode.toUpperCase() });
}

async function importAllCategories(options = {}) {
    const results = {};

    for (const [category, url] of Object.entries(CATEGORY_SOURCES)) {
        console.log(`\n📁 Importing category: ${category}`);
        try {
            results[category] = await importFromUrl(url, { ...options, category });
        } catch (error) {
            results[category] = { error: error.message };
        }
    }

    return results;
}

async function importPopularCountries(options = {}) {
    const popularCountries = ['us', 'uk', 'de', 'fr', 'es', 'in', 'br'];
    const results = {};

    for (const country of popularCountries) {
        console.log(`\n🌍 Importing country: ${country.toUpperCase()}`);
        try {
            results[country] = await importByCountry(country, options);
        } catch (error) {
            results[country] = { error: error.message };
        }
    }

    return results;
}

async function getStats() {
    const totalChannels = await prisma.channel.count();
    const activeChannels = await prisma.channel.count({ where: { isActive: true } });

    const byCategory = await prisma.channel.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
    });

    const byCountry = await prisma.channel.groupBy({
        by: ['country'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20
    });

    return {
        total: totalChannels,
        active: activeChannels,
        byCategory: byCategory.map(c => ({ category: c.category, count: c._count.id })),
        byCountry: byCountry.map(c => ({ country: c.country, count: c._count.id }))
    };
}

async function cleanupDeadChannels(dryRun = true) {
    console.log('🔍 Checking for dead channels...');

    const channels = await prisma.channel.findMany({
        where: { isActive: true },
        select: { id: true, name: true, streamUrl: true }
    });

    const deadChannels = [];

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        const isValid = await validateStream(channel.streamUrl);

        if (!isValid) {
            deadChannels.push(channel);
        }

        if ((i + 1) % 100 === 0) {
            console.log(`Checked ${i + 1}/${channels.length} - Dead: ${deadChannels.length}`);
        }
    }

    console.log(`\nFound ${deadChannels.length} dead channels`);

    if (!dryRun && deadChannels.length > 0) {
        await prisma.channel.updateMany({
            where: { id: { in: deadChannels.map(c => c.id) } },
            data: { isActive: false }
        });
        console.log(`Marked ${deadChannels.length} channels as inactive`);
    }

    return deadChannels;
}

module.exports = {
    FREE_SOURCES,
    CATEGORY_SOURCES,
    COUNTRY_SOURCES,
    parseM3U,
    validateStream,
    importFromUrl,
    importByCategory,
    importByCountry,
    importAllCategories,
    importPopularCountries,
    getStats,
    cleanupDeadChannels
};
