/**
 * Universal Playlist Parsers
 * Supports: M3U, M3U8, JSON, Xtream Codes API, and more
 */

const axios = require('axios');
const { detectStreamInfo, detectStreamType } = require('../utils/stream');

/**
 * Detect playlist format from content or URL
 */
function detectFormat(content, url = '') {
    // Check URL patterns first
    if (url.includes('get.php') || url.includes('player_api.php')) {
        return 'xtream';
    }
    if (url.includes('pluto.tv') || url.includes('i.mjh.nz/PlutoTV')) {
        return 'pluto';
    }
    if (url.includes('samsung') || url.includes('i.mjh.nz/SamsungTVPlus')) {
        return 'samsung';
    }
    if (url.includes('xumo')) {
        return 'xumo';
    }

    // Check content
    const trimmed = content.trim();

    if (trimmed.startsWith('#EXTM3U') || trimmed.startsWith('#EXTINF')) {
        return 'm3u';
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            JSON.parse(trimmed);
            return 'json';
        } catch {
            return 'unknown';
        }
    }
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<tv')) {
        return 'xmltv';
    }

    return 'unknown';
}

/**
 * Parse M3U/M3U8 playlist
 */
function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('#EXTINF:')) {
            const attrs = extractM3UAttributes(trimmed);
            currentChannel = {
                name: attrs.name || 'Unknown',
                logo: attrs.logo || null,
                epgId: attrs.tvgId || null,
                category: attrs.group || 'General',
                country: attrs.country ? attrs.country.toUpperCase() : null,
                language: attrs.language ? attrs.language.toLowerCase() : null,
                description: attrs.name || ''
            };
        } else if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && currentChannel) {
            const streamInfo = detectStreamInfo(trimmed);
            currentChannel.streamUrl = trimmed;
            currentChannel.streamType = streamInfo.streamType;
            currentChannel.fileExt = streamInfo.fileExt;
            channels.push(currentChannel);
            currentChannel = null;
        }
    }

    return channels;
}

/**
 * Extract attributes from M3U #EXTINF line
 */
function extractM3UAttributes(line) {
    const attrs = {};

    // Extract tvg-id
    const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
    if (tvgIdMatch) attrs.tvgId = tvgIdMatch[1] || null;

    // Extract tvg-name
    const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
    if (tvgNameMatch) attrs.tvgName = tvgNameMatch[1] || null;

    // Extract tvg-logo
    const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
    if (tvgLogoMatch) attrs.logo = tvgLogoMatch[1] || null;

    // Extract group-title
    const groupMatch = line.match(/group-title="([^"]*)"/);
    if (groupMatch) attrs.group = groupMatch[1] || null;

    // Extract tvg-country
    const countryMatch = line.match(/tvg-country="([^"]*)"/);
    if (countryMatch) attrs.country = countryMatch[1] || null;

    // Extract tvg-language
    const langMatch = line.match(/tvg-language="([^"]*)"/);
    if (langMatch) attrs.language = langMatch[1] || null;

    // Extract display name (after comma)
    const nameMatch = line.match(/,(.+)$/);
    attrs.name = attrs.tvgName || (nameMatch ? nameMatch[1].trim() : 'Unknown');

    return attrs;
}

/**
 * Parse JSON playlist (various formats)
 */
function parseJSON(content) {
    const data = typeof content === 'string' ? JSON.parse(content) : content;
    const channels = [];

    // Handle array of channels
    if (Array.isArray(data)) {
        for (const item of data) {
            const channel = normalizeJSONChannel(item);
            if (channel) channels.push(channel);
        }
    }
    // Handle object with channels array
    else if (data.channels && Array.isArray(data.channels)) {
        for (const item of data.channels) {
            const channel = normalizeJSONChannel(item);
            if (channel) channels.push(channel);
        }
    }
    // Handle object with items array
    else if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
            const channel = normalizeJSONChannel(item);
            if (channel) channels.push(channel);
        }
    }
    // Handle Pluto TV format
    else if (data.elements && Array.isArray(data.elements)) {
        for (const item of data.elements) {
            const channel = normalizePlutoChannel(item);
            if (channel) channels.push(channel);
        }
    }

    return channels;
}

/**
 * Normalize various JSON channel formats to standard format
 */
function normalizeJSONChannel(item) {
    if (!item) return null;

    // Try to extract stream URL from various possible fields
    const streamUrl = item.streamUrl || item.url || item.stream_url ||
                      item.link || item.src || item.source ||
                      item.stream?.url || item.sources?.[0]?.url;

    if (!streamUrl) return null;

    const streamInfo = detectStreamInfo(streamUrl);
    return {
        name: item.name || item.title || item.channel_name || item.channelName || 'Unknown',
        logo: item.logo || item.image || item.thumbnail || item.icon ||
              item.tvg?.logo || item.channel_logo || null,
        epgId: item.epgId || item.tvg_id || item.epg_channel_id || item.tvg?.id || null,
        category: item.category || item.group || item.genre || item.type || 'General',
        country: (item.country || item.country_code || item.region || '').toUpperCase() || null,
        language: (item.language || item.lang || '').toLowerCase() || null,
        description: item.description || item.desc || item.summary || item.name || '',
        streamUrl: streamUrl,
        streamType: streamInfo.streamType,
        fileExt: streamInfo.fileExt
    };
}

/**
 * Parse Xtream Codes API response
 */
function parseXtreamCodes(data, baseUrl, username, password) {
    const channels = [];

    // Handle live streams
    if (Array.isArray(data)) {
        for (const item of data) {
            const streamUrl = `${baseUrl}/live/${username}/${password}/${item.stream_id}.m3u8`;

            channels.push({
                name: item.name || 'Unknown',
                logo: item.stream_icon || null,
                epgId: item.epg_channel_id || null,
                category: item.category_name || 'Live TV',
                country: null,
                language: null,
                description: item.name || '',
                streamUrl: streamUrl,
                streamType: 'HLS',
                // Extra Xtream metadata
                xtreamId: item.stream_id,
                xtreamNum: item.num,
                xtreamAdded: item.added
            });
        }
    }

    return channels;
}

/**
 * Parse Xtream Codes VOD
 */
function parseXtreamVOD(data, baseUrl, username, password) {
    const items = [];

    if (Array.isArray(data)) {
        for (const item of data) {
            const extension = item.container_extension || 'mp4';
            const streamUrl = `${baseUrl}/movie/${username}/${password}/${item.stream_id}.${extension}`;

            items.push({
                name: item.name || 'Unknown',
                logo: item.stream_icon || null,
                category: item.category_name || 'Movies',
                description: item.plot || item.name || '',
                streamUrl: streamUrl,
                streamType: 'VOD',
                // Extra metadata
                year: item.year,
                rating: item.rating,
                duration: item.duration,
                director: item.director,
                cast: item.cast,
                xtreamId: item.stream_id
            });
        }
    }

    return items;
}

/**
 * Parse Xtream Codes Series
 */
function parseXtreamSeries(data, baseUrl, username, password) {
    const items = [];

    if (Array.isArray(data)) {
        for (const item of data) {
            items.push({
                name: item.name || 'Unknown',
                logo: item.cover || null,
                category: item.category_name || 'Series',
                description: item.plot || item.name || '',
                streamType: 'SERIES',
                // Extra metadata
                year: item.year,
                rating: item.rating,
                genre: item.genre,
                cast: item.cast,
                xtreamSeriesId: item.series_id,
                seasons: [] // Would need separate API call to get episodes
            });
        }
    }

    return items;
}

/**
 * Normalize Pluto TV channel format
 */
function normalizePlutoChannel(item) {
    if (!item) return null;

    // Pluto TV has a specific format
    const streamUrl = item.stitched?.urls?.[0]?.url ||
                      item.url ||
                      item.directSourceUrl;

    if (!streamUrl) return null;

    return {
        name: item.name || item.title || 'Unknown',
        logo: item.colorLogoPNG?.path || item.logo?.path || item.thumbnail?.path || null,
        epgId: item.id || null,
        category: item.category || item.genre || 'Entertainment',
        country: 'US',
        language: 'en',
        description: item.summary || item.description || item.name || '',
        streamUrl: streamUrl,
        streamType: 'HLS',
        plutoId: item.id
    };
}

/**
 * Universal parser - auto-detects format
 */
async function parsePlaylist(content, url = '') {
    const format = detectFormat(content, url);

    switch (format) {
        case 'm3u':
            return { format: 'm3u', channels: parseM3U(content) };
        case 'json':
            return { format: 'json', channels: parseJSON(content) };
        case 'xmltv':
            return { format: 'xmltv', channels: [], epg: content }; // EPG data, not channels
        default:
            // Try M3U first, then JSON
            try {
                const m3uChannels = parseM3U(content);
                if (m3uChannels.length > 0) {
                    return { format: 'm3u', channels: m3uChannels };
                }
            } catch {}

            try {
                const jsonChannels = parseJSON(content);
                if (jsonChannels.length > 0) {
                    return { format: 'json', channels: jsonChannels };
                }
            } catch {}

            return { format: 'unknown', channels: [] };
    }
}

module.exports = {
    detectFormat,
    parseM3U,
    parseJSON,
    parseXtreamCodes,
    parseXtreamVOD,
    parseXtreamSeries,
    parsePlaylist,
    detectStreamType,
    detectStreamInfo,
    extractM3UAttributes,
    normalizeJSONChannel,
    normalizePlutoChannel
};
