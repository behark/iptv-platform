const axios = require('axios');
const { URL } = require('url');
const dns = require('dns').promises;
const fs = require('fs').promises;
const path = require('path');
const prisma = require('../lib/prisma');
const { detectStreamInfo } = require('../utils/stream');

// Private IP ranges to block for SSRF protection
const PRIVATE_IP_RANGES = [
    /^127\./,                      // Loopback
    /^10\./,                       // Private Class A
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
    /^192\.168\./,                 // Private Class C
    /^169\.254\./,                 // Link-local
    /^0\./,                        // Current network
    /^224\./,                      // Multicast
    /^240\./,                      // Reserved
    /^255\./,                      // Broadcast
    /^::1$/,                       // IPv6 loopback
    /^fc00:/i,                     // IPv6 unique local
    /^fe80:/i,                     // IPv6 link-local
    /^ff00:/i,                     // IPv6 multicast
];

// Allowed URL schemes
const ALLOWED_SCHEMES = ['http:', 'https:'];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
    'localhost',
    'localhost.localdomain',
    'local',
    'broadcasthost',
    'ip6-localhost',
    'ip6-loopback',
];

/**
 * Validate URL for SSRF attacks
 * @param {string} urlString - URL to validate
 * @returns {Promise<boolean>} - True if URL is safe
 */
async function validateUrlForSSRF(urlString) {
    try {
        const parsedUrl = new URL(urlString);

        // Check scheme
        if (!ALLOWED_SCHEMES.includes(parsedUrl.protocol)) {
            console.warn(`Blocked URL with scheme: ${parsedUrl.protocol}`);
            return false;
        }

        // Check for blocked hostnames
        const hostname = parsedUrl.hostname.toLowerCase();
        if (BLOCKED_HOSTNAMES.includes(hostname)) {
            console.warn(`Blocked localhost access: ${hostname}`);
            return false;
        }

        // Check if hostname is an IP address
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

        if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
            // Direct IP address - check against private ranges
            for (const pattern of PRIVATE_IP_RANGES) {
                if (pattern.test(hostname)) {
                    console.warn(`Blocked private IP: ${hostname}`);
                    return false;
                }
            }
        } else {
            // Hostname - resolve and check DNS
            try {
                const addresses = await dns.resolve4(hostname);
                for (const ip of addresses) {
                    for (const pattern of PRIVATE_IP_RANGES) {
                        if (pattern.test(ip)) {
                            console.warn(`Blocked hostname resolving to private IP: ${hostname} -> ${ip}`);
                            return false;
                        }
                    }
                }
            } catch (dnsError) {
                // If DNS resolution fails for a new hostname, allow known good domains
                const trustedDomains = [
                    'iptv-org.github.io',
                    'github.com',
                    'githubusercontent.com',
                    'raw.githubusercontent.com',
                    'gjirafa.net',
                    'gjirafa.com',
                    'tring.al',
                    'rtsh.al',
                    'a2news.com',
                    'bhtelecom.ba',
                    'rtvbn.tv',
                    'rtrs.tv'
                ];

                const isTrusted = trustedDomains.some(domain =>
                    hostname === domain || hostname.endsWith('.' + domain)
                );

                if (!isTrusted) {
                    console.warn(`DNS resolution failed for: ${hostname}`);
                    // Allow the request but log it - DNS might just be slow
                }
            }
        }

        return true;
    } catch (error) {
        console.error(`URL validation error: ${error.message}`);
        return false;
    }
}

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
    eg: 'https://iptv-org.github.io/iptv/countries/eg.m3u',
    al: 'https://iptv-org.github.io/iptv/countries/al.m3u',
    xk: 'https://iptv-org.github.io/iptv/countries/xk.m3u',
    mk: 'https://iptv-org.github.io/iptv/countries/mk.m3u',
    me: 'https://iptv-org.github.io/iptv/countries/me.m3u',
    rs: 'https://iptv-org.github.io/iptv/countries/rs.m3u',
    ba: 'https://iptv-org.github.io/iptv/countries/ba.m3u',
    hr: 'https://iptv-org.github.io/iptv/countries/hr.m3u',
    si: 'https://iptv-org.github.io/iptv/countries/si.m3u',
    bg: 'https://iptv-org.github.io/iptv/countries/bg.m3u',
    ro: 'https://iptv-org.github.io/iptv/countries/ro.m3u',
    gr: 'https://iptv-org.github.io/iptv/countries/gr.m3u'
};

const LANGUAGE_SOURCES = {
    sqi: 'https://iptv-org.github.io/iptv/languages/sqi.m3u',
    srp: 'https://iptv-org.github.io/iptv/languages/srp.m3u',
    bos: 'https://iptv-org.github.io/iptv/languages/bos.m3u',
    hrv: 'https://iptv-org.github.io/iptv/languages/hrv.m3u',
    mkd: 'https://iptv-org.github.io/iptv/languages/mkd.m3u',
    slv: 'https://iptv-org.github.io/iptv/languages/slv.m3u',
    bul: 'https://iptv-org.github.io/iptv/languages/bul.m3u',
    ron: 'https://iptv-org.github.io/iptv/languages/ron.m3u',
    ell: 'https://iptv-org.github.io/iptv/languages/ell.m3u',
    tur: 'https://iptv-org.github.io/iptv/languages/tur.m3u'
};

const FREETV_SOURCES = {
    al: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_albania.m3u8',
    xk: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_kosovo.m3u8',
    mk: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_north_macedonia.m3u8',
    me: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_montenegro.m3u8',
    rs: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_serbia.m3u8',
    ba: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_bosnia_and_herzegovina.m3u8',
    hr: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_croatia.m3u8',
    si: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_slovenia.m3u8',
    bg: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_bulgaria.m3u8',
    ro: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_romania.m3u8',
    gr: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_greece.m3u8'
};

const FREETV_FULL = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';

const BALKAN_COUNTRIES = ['al', 'xk', 'mk', 'me', 'rs', 'ba', 'hr', 'si', 'bg', 'ro', 'gr'];
const BALKAN_LANGUAGES = ['sqi', 'srp', 'bos', 'hrv', 'mkd', 'slv', 'bul', 'ron', 'ell'];

const BALKAN_NAME_PATTERNS = [
    /\bRTK\s*[1-4]?\b/i, /\bKlan\b/i, /\bTop\s*Channel\b/i, /\bVizion\s*Plus\b/i,
    /\bRTV\s*21\b/i, /\bAlsat\b/i, /\bKohavision\b/i, /\bTring\b/i, /\bDigitAlb\b/i,
    /\bA2\s*CNN\b/i, /\bReport\s*TV\b/i, /\bOra\s*News\b/i, /\bNews\s*24.*Alb/i,
    /\bTV\s*Arb[eë]ria\b/i, /\bTV\s*Opoja\b/i, /\bTV\s*Dielli\b/i, /\bABC\s*News.*Alb/i,
    /\bT7\b/i, /\bDukagjini\b/i, /\bKlan\s*Kosova\b/i, /\bATV\s*Kosov/i, /\bTV\s*Era\b/i,
    /\bBesa\s*TV\b/i, /\bTV\s*Prizren\b/i, /\bKanal\s*10.*KS/i, /\bTV\s*Tema\b/i,
    /\bRTV\s*Pend/i, /\bTV\s*Mitrov/i, /\bSyri\b/i, /\bEuronews\s*Alb/i, /\bAlpo\s*TV\b/i,
    /\bCNA\b.*\bal\b/i, /\bTropoja\b/i, /\bTop\s*News.*\bal\b/i, /\bPanorama\s*TV\b/i,
    /\bTV\s*7\s*Albania\b/i, /\bTV\s*Apollon\b/i, /\bAlbKanale/i, /\bKanali\s*7\b/i,
    /\bRTS\s*[1-3]?\b/i, /\bRTV\s*[1-2]\b.*\brs\b/i, /\bN1\s*Bosn/i, /\bN1\s*Serb/i,
    /\bHRT\s*[1-4]\b/i, /\bRTL\s*Croatia\b/i, /\bNova\s*TV.*hr\b/i,
    /\bBHT\s*1\b/i, /\bFederalna/i, /\bRTRS\b/i, /\bRTV\s*BN\b/i,
    /\bMRT\s*[1-5]?\b/i, /\bKanal\s*5.*mk\b/i, /\bSitel\b/i, /\bTelma\b/i,
    /\bTV\s*21.*mk\b/i,
    /\bZICO\s*TV\b/i, /\bPRO\s*1\b/i, /\bRTV\s*Besa\b/i, /\bTV\s*News\b.*\bxk\b/i,
    /\bGlam\s*Radio\b/i, /\bRadio\s*Dukagjini\b/i, /\bRadio\s*Kosova\b/i,
    /\bRadio\s*Prishtina\b/i, /\bRadio\s*Gjakova\b/i, /\bClubFM\s*Kosova\b/i,
    /\bTV\s*Arb[eë]ria\s*[1-5]?\b/i, /\bTV\s*Dielli\b/i, /\bTV\s*Opoja\b/i,
    /\bRTV\s*Pendimi\b/i, /\bZjarr\s*TV\b/i, /\bTopEstrada\b/i,
    /\bAlbDreams\b/i, /\bShqiponja\s*TV\b/i, /\bDrita\s*TV\b/i,
    /\bAlbUK\b/i, /\bGlobe\s*TV\b/i, /\bNRG\s*Muzik\b/i, /\bDasma\s*TV\b/i,
    /\bFestina\s*TV\b/i, /\bUlqini\s*TV\b/i, /\bBulevard\s*TV\b/i,
    /\bRTV\s*Zik\b/i, /\bRTV\s*Flaka\b/i, /\bTV\s*Mitrovica\b/i,
    /\bAlbFilm\b/i, /\bTV\s*KOHA\b/i, /\bRTV\s*Ilirida\b/i,
    /\bTV\s*Rozafa\b/i, /\bTV\s*Kopliku\b/i, /\bRTV\s*Presheva\b/i,
    /\bTV\s*Apollon\b/i, /\bRTV\s*Islam\b/i, /\bRTSH\s*[1-3]?\b/i
];

const BALKAN_GROUP_PATTERNS = [
    /albania/i, /kosovo/i, /serbia/i, /croatia/i, /bosni/i,
    /montenegr/i, /macedoni/i, /balkan/i, /shqip/i, /ex[\.\-\s]*yu/i
];

function normalizeAttr(value) {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
}

function isPresent(value) {
    return normalizeAttr(value) !== null;
}

function isMeaningfulName(value) {
    const normalized = normalizeAttr(value);
    if (!normalized) return false;
    return normalized.toLowerCase() !== 'unknown';
}

function isMeaningfulCategory(value) {
    const normalized = normalizeAttr(value);
    if (!normalized) return false;
    return normalized.toLowerCase() !== 'uncategorized';
}

function mergeChannel(base, candidate) {
    const merged = { ...base };

    if (!isMeaningfulName(merged.name) && isMeaningfulName(candidate.name)) {
        merged.name = candidate.name;
    } else if (!isPresent(merged.name) && isPresent(candidate.name)) {
        merged.name = candidate.name;
    }

    if ((!isPresent(merged.description) || merged.description === merged.name) && isPresent(candidate.description)) {
        merged.description = candidate.description;
    }

    if (!isPresent(merged.logo) && isPresent(candidate.logo)) {
        merged.logo = candidate.logo;
    }

    if (!isMeaningfulCategory(merged.category) && isMeaningfulCategory(candidate.category)) {
        merged.category = candidate.category;
    } else if (!isPresent(merged.category) && isPresent(candidate.category)) {
        merged.category = candidate.category;
    }

    if (!isPresent(merged.country) && isPresent(candidate.country)) {
        merged.country = candidate.country;
    }

    if (!isPresent(merged.language) && isPresent(candidate.language)) {
        merged.language = candidate.language;
    }

    if (!isPresent(merged.epgId) && isPresent(candidate.epgId)) {
        merged.epgId = candidate.epgId;
    }

    if (!isPresent(merged.streamType) && isPresent(candidate.streamType)) {
        merged.streamType = candidate.streamType;
    }

    if (!isPresent(merged.fileExt) && isPresent(candidate.fileExt)) {
        merged.fileExt = candidate.fileExt;
    }

    return merged;
}

function dedupeChannelsByStreamUrl(channels) {
    const byUrl = new Map();

    for (const channel of channels) {
        if (!channel?.streamUrl) continue;
        const normalizedUrl = channel.streamUrl.trim();
        if (!normalizedUrl) continue;

        channel.streamUrl = normalizedUrl;
        const existing = byUrl.get(normalizedUrl);
        if (!existing) {
            byUrl.set(normalizedUrl, channel);
            continue;
        }

        byUrl.set(normalizedUrl, mergeChannel(existing, channel));
    }

    return Array.from(byUrl.values());
}

function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);
            const tvgCountryMatch = line.match(/tvg-country="([^"]*)"/);
            const tvgLanguageMatch = line.match(/tvg-language="([^"]*)"/);

            const nameMatch = line.match(/,(.+)$/);

            const epgId = normalizeAttr(tvgIdMatch ? tvgIdMatch[1] : null);
            const tvgName = normalizeAttr(tvgNameMatch ? tvgNameMatch[1] : null);
            const logo = normalizeAttr(tvgLogoMatch ? tvgLogoMatch[1] : null);
            const category = normalizeAttr(groupMatch ? groupMatch[1] : null);
            const country = normalizeAttr(tvgCountryMatch ? tvgCountryMatch[1] : null);
            const language = normalizeAttr(tvgLanguageMatch ? tvgLanguageMatch[1] : null);
            const fallbackName = nameMatch ? nameMatch[1].trim() : null;

            currentChannel = {
                epgId,
                name: tvgName || fallbackName || 'Unknown',
                logo,
                category,
                country: country ? country.toUpperCase() : null,
                language: language ? language.toLowerCase() : null,
                description: fallbackName || ''
            };
        } else if ((line.startsWith('http://') || line.startsWith('https://')) && currentChannel) {
            const streamInfo = detectStreamInfo(line);
            currentChannel.streamUrl = line;
            currentChannel.streamType = streamInfo.streamType;
            currentChannel.fileExt = streamInfo.fileExt;
            channels.push(currentChannel);
            currentChannel = null;
        }
    }

    return channels;
}

async function validateStream(url, timeout = 5000) {
    const validateStatus = (status) => status >= 200 && status < 400;

    try {
        // Validate URL for SSRF before making request
        const isSafe = await validateUrlForSSRF(url);
        if (!isSafe) {
            console.warn(`Stream validation blocked for: ${url}`);
            return false;
        }

        await axios.head(url, {
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 5,
            validateStatus
        });
        return true;
    } catch {
        // Some providers block HEAD requests. Fall back to GET with minimal body.
        try {
            const response = await axios.get(url, {
                timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    Range: 'bytes=0-1024'
                },
                maxRedirects: 5,
                responseType: 'stream',
                validateStatus
            });
            // Prevent dangling sockets when validating many channels.
            response.data?.destroy?.();
            return true;
        } catch {
            return false;
        }
    }
}


async function importFromFile(filePath, options = {}) {
    const {
        validateStreams = false,
        category = null,
        country = null,
        language = null,
        batchSize = 100,
        onProgress = null
    } = options;

    console.log(`Importing playlist from file: ${filePath}`);

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsedChannels = parseM3U(content);
        const channels = dedupeChannelsByStreamUrl(parsedChannels);
        const duplicatesRemoved = parsedChannels.length - channels.length;
        console.log(`Found ${parsedChannels.length} channels in playlist`);
        if (duplicatesRemoved > 0) {
            console.log(`Removed ${duplicatesRemoved} duplicate stream URLs`);
        }

        let imported = 0;
        let updated = 0;
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
                        fileExt: channel.fileExt,
                        category: category || channel.category || 'Uncategorized',
                        country: country || channel.country || 'INT',
                        language: language || channel.language || 'en',
                        epgId: channel.epgId,
                        isActive: true,
                        isLive: true
                    };

                    const existingChannel = await prisma.channel.findFirst({
                        where: { streamUrl: channel.streamUrl }
                    });

                    if (existingChannel) {
                        const updates = {};
                        if (channelData.logo && channelData.logo.trim() !== '' && !existingChannel.logo) {
                            updates.logo = channelData.logo;
                        }
                        if (!existingChannel.fileExt && channelData.fileExt) {
                            updates.fileExt = channelData.fileExt;
                        }
                        if ((!existingChannel.country || existingChannel.country === 'INT') && channelData.country && channelData.country !== 'INT') {
                            updates.country = channelData.country;
                        }
                        if ((!existingChannel.language || existingChannel.language === 'en') && channelData.language && channelData.language !== 'en') {
                            updates.language = channelData.language;
                        }
                        if (!existingChannel.epgId && channelData.epgId) {
                            updates.epgId = channelData.epgId;
                        }
                        if ((!existingChannel.description || existingChannel.description === existingChannel.name) && channelData.description) {
                            updates.description = channelData.description;
                        }
                        if (!isMeaningfulName(existingChannel.name) && isMeaningfulName(channelData.name)) {
                            updates.name = channelData.name;
                        }
                        if (!isMeaningfulCategory(existingChannel.category) && isMeaningfulCategory(channelData.category)) {
                            updates.category = channelData.category;
                        }

                        if (Object.keys(updates).length > 0) {
                            updates.updatedAt = new Date();
                            await prisma.channel.update({
                                where: { id: existingChannel.id },
                                data: updates
                            });
                            updated++;
                        } else {
                            skipped++;
                        }
                    } else {
                        await prisma.channel.create({ data: channelData });
                        imported++;
                    }
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
                    updated,
                    skipped,
                    failed
                });
            }

            console.log(`Progress: ${Math.min(i + batchSize, channels.length)}/${channels.length} (Imported: ${imported}, Updated: ${updated})`);
        }

        return { imported, updated, skipped, failed, total: channels.length };
    } catch (error) {
        console.error(`Error importing from ${filePath}:`, error.message);
        throw error;
    }
}

async function importFromUrl(url, options = {}) {
    const {
        validateStreams = false,
        category = null,
        country = null,
        language = null,
        batchSize = 100,
        onProgress = null
    } = options;

    // Validate URL for SSRF before fetching
    const isSafe = await validateUrlForSSRF(url);
    if (!isSafe) {
        throw new Error(`URL blocked for security reasons: ${url}`);
    }

    console.log(`Fetching playlist from: ${url}`);

    try {
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 5,
            maxContentLength: 50 * 1024 * 1024 // 50MB max
        });

        const parsedChannels = parseM3U(response.data);
        const channels = dedupeChannelsByStreamUrl(parsedChannels);
        const duplicatesRemoved = parsedChannels.length - channels.length;
        console.log(`Found ${parsedChannels.length} channels in playlist`);
        if (duplicatesRemoved > 0) {
            console.log(`Removed ${duplicatesRemoved} duplicate stream URLs`);
        }

        let imported = 0;
        let updated = 0;
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
                        fileExt: channel.fileExt,
                        category: category || channel.category || 'Uncategorized',
                        country: country || channel.country || 'INT',
                        language: language || channel.language || 'en',
                        epgId: channel.epgId,
                        isActive: true,
                        isLive: true
                    };

                    const existingChannel = await prisma.channel.findFirst({
                        where: { streamUrl: channel.streamUrl }
                    });

                    if (existingChannel) {
                        const updates = {};
                        if (channelData.logo && channelData.logo.trim() !== '' && !existingChannel.logo) {
                            updates.logo = channelData.logo;
                        }
                        if (!existingChannel.fileExt && channelData.fileExt) {
                            updates.fileExt = channelData.fileExt;
                        }
                        if ((!existingChannel.country || existingChannel.country === 'INT') && channelData.country && channelData.country !== 'INT') {
                            updates.country = channelData.country;
                        }
                        if ((!existingChannel.language || existingChannel.language === 'en') && channelData.language && channelData.language !== 'en') {
                            updates.language = channelData.language;
                        }
                        if (!existingChannel.epgId && channelData.epgId) {
                            updates.epgId = channelData.epgId;
                        }
                        if ((!existingChannel.description || existingChannel.description === existingChannel.name) && channelData.description) {
                            updates.description = channelData.description;
                        }
                        if (!isMeaningfulName(existingChannel.name) && isMeaningfulName(channelData.name)) {
                            updates.name = channelData.name;
                        }
                        if (!isMeaningfulCategory(existingChannel.category) && isMeaningfulCategory(channelData.category)) {
                            updates.category = channelData.category;
                        }

                        if (Object.keys(updates).length > 0) {
                            updates.updatedAt = new Date();
                            await prisma.channel.update({
                                where: { id: existingChannel.id },
                                data: updates
                            });
                            updated++;
                        } else {
                            skipped++;
                        }
                    } else {
                        await prisma.channel.create({ data: channelData });
                        imported++;
                    }
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
                    updated,
                    skipped,
                    failed
                });
            }

            console.log(`Progress: ${Math.min(i + batchSize, channels.length)}/${channels.length} (Imported: ${imported}, Updated: ${updated})`);
        }

        return { imported, updated, skipped, failed, total: channels.length };
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
        console.log(`\nImporting category: ${category}`);
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
        console.log(`\nImporting country: ${country.toUpperCase()}`);
        try {
            results[country] = await importByCountry(country, options);
        } catch (error) {
            results[country] = { error: error.message };
        }
    }

    return results;
}

async function importByLanguage(langCode, options = {}) {
    const url = LANGUAGE_SOURCES[langCode.toLowerCase()];
    if (!url) {
        throw new Error(`Unknown language: ${langCode}. Available: ${Object.keys(LANGUAGE_SOURCES).join(', ')}`);
    }
    return importFromUrl(url, { ...options, language: langCode });
}

function isBalkanChannel(channel) {
    const name = channel.name || '';
    const group = channel.category || '';
    const country = (channel.country || '').toUpperCase();

    const balkanCountrySet = new Set(BALKAN_COUNTRIES.map(c => c.toUpperCase()));
    if (balkanCountrySet.has(country)) return true;

    for (const pattern of BALKAN_NAME_PATTERNS) {
        if (pattern.test(name)) return true;
    }
    for (const pattern of BALKAN_GROUP_PATTERNS) {
        if (pattern.test(group)) return true;
    }

    return false;
}

async function importBalkanChannels(options = {}) {
    const results = { countries: {}, languages: {}, freetv: {} };
    let totalImported = 0;

    console.log('\n=== Phase 1: iptv-org Country Playlists ===');
    for (const country of BALKAN_COUNTRIES) {
        console.log(`\nImporting country: ${country.toUpperCase()}`);
        try {
            const result = await importByCountry(country, options);
            results.countries[country] = result;
            totalImported += result.imported || 0;
        } catch (error) {
            results.countries[country] = { error: error.message };
        }
    }

    console.log('\n=== Phase 2: iptv-org Language Playlists ===');
    for (const lang of BALKAN_LANGUAGES) {
        console.log(`\nImporting language: ${lang}`);
        try {
            const result = await importByLanguage(lang, options);
            results.languages[lang] = result;
            totalImported += result.imported || 0;
        } catch (error) {
            results.languages[lang] = { error: error.message };
        }
    }

    console.log('\n=== Phase 3: Free-TV/IPTV Playlists ===');
    for (const [country, url] of Object.entries(FREETV_SOURCES)) {
        console.log(`\nImporting Free-TV ${country.toUpperCase()}: ${url}`);
        try {
            const result = await importFromUrl(url, { ...options, country: country.toUpperCase() });
            results.freetv[country] = result;
            totalImported += result.imported || 0;
        } catch (error) {
            results.freetv[country] = { error: error.message };
        }
    }

    console.log(`\n=== Balkan Import Complete: ${totalImported} new channels imported ===`);
    return results;
}

async function importFromLocalPlaylist(filePath, filterOptions = {}) {
    const { countries = [], languages = [], useNameMatching = true } = filterOptions;
    const countrySet = new Set(countries.map(c => c.toUpperCase()));
    const langSet = new Set(languages.map(l => l.toLowerCase()));
    const hasFilters = countrySet.size > 0 || langSet.size > 0 || useNameMatching;

    console.log(`Reading local playlist: ${filePath}`);
    const content = await fs.readFile(filePath, 'utf-8');
    const allChannels = parseM3U(content);
    console.log(`Parsed ${allChannels.length} total channels from file`);

    let filtered = allChannels;
    if (hasFilters) {
        filtered = allChannels.filter(ch => {
            const matchCountry = countrySet.size > 0 && ch.country && countrySet.has(ch.country.toUpperCase());
            const matchLang = langSet.size > 0 && ch.language && langSet.has(ch.language.toLowerCase());
            const matchName = useNameMatching && isBalkanChannel(ch);
            return matchCountry || matchLang || matchName;
        });
        console.log(`Filtered to ${filtered.length} channels (country tags + name/group matching)`);
    }

    const channels = dedupeChannelsByStreamUrl(filtered);
    console.log(`After dedup: ${channels.length} unique channels`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const channel of channels) {
        try {
            const channelData = {
                name: channel.name.substring(0, 255),
                description: (channel.description || channel.name || '').substring(0, 255),
                logo: channel.logo,
                streamUrl: channel.streamUrl,
                streamType: channel.streamType,
                fileExt: channel.fileExt,
                category: channel.category || 'Uncategorized',
                country: channel.country || 'INT',
                language: channel.language || 'en',
                epgId: channel.epgId,
                isActive: true,
                isLive: true
            };

            const existing = await prisma.channel.findFirst({
                where: { streamUrl: channel.streamUrl }
            });

            if (existing) {
                const updates = {};
                if (channel.logo && !existing.logo) updates.logo = channel.logo;
                if (channel.name && existing.name === 'Unknown') updates.name = channel.name.substring(0, 255);
                if (!existing.fileExt && channel.fileExt) updates.fileExt = channel.fileExt;
                if (Object.keys(updates).length > 0) {
                    await prisma.channel.update({ where: { id: existing.id }, data: updates });
                }
                skipped++;
                continue;
            }

            await prisma.channel.create({ data: channelData });
            imported++;

            if (imported % 100 === 0) {
                process.stdout.write(`\r  Imported: ${imported}`);
            }
        } catch (error) {
            failed++;
        }
    }

    console.log(`\nResult: imported=${imported} skipped=${skipped} failed=${failed}`);
    return { imported, skipped, failed, total: channels.length };
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
    console.log('Checking for dead channels...');

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
    LANGUAGE_SOURCES,
    FREETV_SOURCES,
    FREETV_FULL,
    BALKAN_COUNTRIES,
    BALKAN_LANGUAGES,
    BALKAN_NAME_PATTERNS,
    BALKAN_GROUP_PATTERNS,
    parseM3U,
    validateStream,
    validateUrlForSSRF,
    isBalkanChannel,
    importFromFile,
    importFromUrl,
    importByCategory,
    importByCountry,
    importByLanguage,
    importAllCategories,
    importPopularCountries,
    importBalkanChannels,
    importFromLocalPlaylist,
    getStats,
    cleanupDeadChannels
};
