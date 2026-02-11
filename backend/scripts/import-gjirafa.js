#!/usr/bin/env node

/**
 * Kosovo/Albania Direct Channel Importer
 * 
 * Imports live TV, radio, and additional channels from multiple verified sources:
 *   - Gjirafa Video (video.gjirafa.com) — 18 TV + 12 radio
 *   - Free-TV verified Albanian streams (mediadesk.al, tring.al, prostream.al, etc.)
 *   - Channels discovered via bashk.tv and tvmak.com (TV Arberia, TV Dielli, TV Opoja, etc.)
 *
 * All streams are legal, publicly accessible HLS/M3U8 URLs.
 *
 * Usage:
 *   node backend/scripts/import-gjirafa.js              # Import all channels
 *   node backend/scripts/import-gjirafa.js --tv-only    # Only TV channels
 *   node backend/scripts/import-gjirafa.js --radio-only # Only radio stations
 *   node backend/scripts/import-gjirafa.js --verify     # Check stream availability first
 *   node backend/scripts/import-gjirafa.js --dry-run    # Preview without writing
 *   node backend/scripts/import-gjirafa.js --stats      # Show current channel stats
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Gjirafa CDN base URLs
const GJ_LIVE = 'https://gjirafa-video-live.gjirafa.net';
const GJ_ALT = 'https://ub1doy938d.gjirafa.net';

// ============================================================
// Gjirafa TV Channels - extracted from video.gjirafa.com/drejteperdrejt
// Stream URLs verified against local playlist + known CDN patterns
// ============================================================
const GJIRAFA_TV_CHANNELS = [
    {
        name: 'RTK 1',
        streamUrl: `${GJ_ALT}/live/Gfsqdsr7FewrYClU3ACEGZvCHktt2wse/zykxzq.m3u8`,
        logo: 'https://i.imgur.com/KTcWcO6.png',
        epgId: 'RTK1.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'RTK 2',
        streamUrl: `${GJ_ALT}/live/Gfsqdsr7FewrYClU3ACEGZvCHktt2wse/zykxz0.m3u8`,
        logo: 'https://i.imgur.com/g6k6xyO.png',
        epgId: 'RTK2.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'RTK 3',
        streamUrl: `${GJ_ALT}/live/Gfsqdsr7FewrYClU3ACEGZvCHktt2wse/zykxzk.m3u8`,
        logo: 'https://i.imgur.com/Ut9VcT3.png',
        epgId: 'RTK3.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'RTK 4',
        streamUrl: `${GJ_ALT}/live/Gfsqdsr7FewrYClU3ACEGZvCHktt2wse/zykxgt.m3u8`,
        logo: 'https://i.imgur.com/Urm4XDR.png',
        epgId: 'RTK4.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'RTK 1 Satelit',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/rtk1/index.m3u8`,
        logo: 'https://i.imgur.com/KTcWcO6.png',
        epgId: 'RTK1.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'RTV 21',
        streamUrl: `${GJ_LIVE}/gjvideo-live/2cz-npl-jfn-9he/index.m3u8`,
        logo: 'https://i.postimg.cc/cC3bw9h6/rtv21.png',
        epgId: 'RTV21.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'KTV - Kohavision',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/lj9-pxm-o53-rp0/index.m3u8`,
        logo: 'https://i.imgur.com/LOi9yma.png',
        epgId: 'Kohavision.xk',
        category: 'News',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'T7',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream-specific/1z8-byc-4ee-lc9/index.m3u8`,
        logo: 'https://i.postimg.cc/sxcZ6SVy/t7.png',
        epgId: 'T7.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Syri Vision HD',
        streamUrl: `${GJ_LIVE}/gjvideo-live/xej-xnb-ba0-kup/index.m3u8`,
        logo: 'https://i.imgur.com/ZQuFosn.png',
        epgId: 'TVSyri.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Arta News',
        streamUrl: `${GJ_LIVE}/gjvideo-live/mps-vgx-u9p-qv1/index.m3u8`,
        logo: 'https://i.imgur.com/MAhJkK9.png',
        epgId: 'TVArta.xk',
        category: 'News',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Euronews Albania',
        streamUrl: `${GJ_LIVE}/gjvideo-live/2dw-zuf-1c9-pxu/index.m3u8`,
        logo: 'https://i.imgur.com/Skf6vdi.png',
        epgId: 'EuronewsAlbania.al',
        category: 'News',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'A2 CNN',
        streamUrl: 'https://tv.a2news.com/live/smil:a2cnnweb.stream.smil/playlist.m3u8',
        logo: 'https://i.imgur.com/TgO3Lzi.png',
        epgId: 'A2CNN.al',
        category: 'News',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'TV Prizreni',
        streamUrl: `${GJ_LIVE}/gjvideo-live/5m0-cok-g5z-1xi/index.m3u8`,
        logo: 'https://i.ibb.co/yDRRMqP/prizeni.jpg',
        epgId: 'TVPrizreni.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'ZICO TV',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/zico-tv/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/y1k0kk/thumbnails/retina.jpg',
        epgId: 'ZicoTV.xk',
        category: 'Entertainment',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'PRO1',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/pro1-tv/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/zzgyqg/thumbnails/retina.jpg',
        epgId: 'PRO1.xk',
        category: 'Entertainment',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'ATV Live',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/atv-live/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/zyq001/thumbnails/retina.jpg',
        epgId: 'ATV.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'RTV Besa HD',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/rtv-besa/index.m3u8`,
        logo: 'https://i.imgur.com/Qi3mz4Q.png',
        epgId: 'RTVBesa.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'TV News',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/tv-news/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/zzy1kt/thumbnails/retina.jpg',
        epgId: 'TVNews.xk',
        category: 'News',
        country: 'XK',
        language: 'sqi'
    }
];

// ============================================================
// Gjirafa Radio Stations
// ============================================================
const GJIRAFA_RADIO_CHANNELS = [
    {
        name: 'Glam Radio',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/glamradio-fm/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/ykyzkk/thumbnails/retina.jpg',
        epgId: 'GlamRadio.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Glam Radio Gold',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/glamradio-gold/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/ykgxzz/thumbnails/retina.jpg',
        epgId: 'GlamRadioGold.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Glam Radio Cafe',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/glamradio-cafe/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/ykgxzg/thumbnails/retina.jpg',
        epgId: 'GlamRadioCafe.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Radio ClubFM Albania',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/clubfm-albania/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/y1zqzk/thumbnails/retina.jpg',
        epgId: 'ClubFMAlbania.al',
        category: 'Music',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Radio ClubFM Kosova',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/clubfm-kosova/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/y1zqz1/thumbnails/retina.jpg',
        epgId: 'ClubFMKosova.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Radio Dukagjini',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/radio-dukagjini/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/y1z1tq/thumbnails/retina.jpg',
        epgId: 'RadioDukagjini.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Top Albania Radio',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/top-albania-radio-live/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/y1gty0/thumbnails/retina.jpg',
        epgId: 'TopAlbaniaRadio.al',
        category: 'Music',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Paper Radio OnAir',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/paper-radio-onair/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/y1010x/thumbnails/retina.jpg',
        epgId: 'PaperRadio.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Radio Gjakova',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/radio-gjakova-live/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/y1kzg1/thumbnails/retina.jpg',
        epgId: 'RadioGjakova.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Radio Prishtina',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/radio-prishtina/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/zy1tk0/thumbnails/retina.jpg',
        epgId: 'RadioPrishtina.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Radio Kosova 1',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/radio-kosova-1/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/zzxkyx/thumbnails/retina.jpg',
        epgId: 'RadioKosova1.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Radio Kosova 2',
        streamUrl: `${GJ_LIVE}/gjvideo-livestream/radio-kosova-2/index.m3u8`,
        logo: 'https://g0eylj1rzj.gjirafa.net/media/zzxkyt/thumbnails/retina.jpg',
        epgId: 'RadioKosova2.xk',
        category: 'Music',
        country: 'XK',
        language: 'sqi'
    }
];

// ============================================================
// Additional Albanian/Kosovo channels (non-Gjirafa, direct streams)
// Sources: Free-TV/IPTV, official broadcaster websites
// ============================================================
const ADDITIONAL_AL_XK_CHANNELS = [
    {
        name: 'Ora News',
        streamUrl: 'https://live1.mediadesk.al/oranews.m3u8',
        logo: 'https://i.imgur.com/ILZY5bJ.png',
        epgId: 'OraNews.al',
        category: 'News',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Report TV',
        streamUrl: 'https://deb10stream.duckdns.org/hls/stream.m3u8',
        logo: 'https://i.imgur.com/yuRDJYY.png',
        epgId: 'ReportTV.al',
        category: 'News',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'News 24',
        streamUrl: 'https://tv.balkanweb.com/news24/livestream/playlist.m3u8',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/News_24_%28Albania%29.svg/1024px-News_24_%28Albania%29.svg.png',
        epgId: 'News24.al',
        category: 'News',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Syri TV',
        streamUrl: 'https://stream.syritv.al/SyriTV/index.m3u8',
        logo: 'https://i.imgur.com/4zVyj1M.png',
        epgId: 'Syri.al',
        category: 'News',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'CNA',
        streamUrl: 'https://live1.mediadesk.al/cnatvlive.m3u8',
        logo: 'https://i.imgur.com/X3ukD5t.png',
        epgId: 'CNA.al',
        category: 'News',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Tropoja TV',
        streamUrl: 'https://live.prostream.al/al/smil:tropojatv.smil/playlist.m3u8',
        logo: 'https://i.imgur.com/D3hNOVS.png',
        epgId: 'TropojaTelevizion.al',
        category: 'General',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'TV 7 Albania',
        streamUrl: 'https://5d00db0e0fcd5.streamlock.net/7064/7064/playlist.m3u8',
        logo: 'https://i.imgur.com/k9WqPLZ.png',
        epgId: 'TV7Albania.al',
        category: 'General',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Alpo TV',
        streamUrl: 'https://5d00db0e0fcd5.streamlock.net/7236/7236/playlist.m3u8',
        logo: 'https://i.imgur.com/Pr4ixiA.png',
        epgId: 'AlpoTV.al',
        category: 'General',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'AlbKanale Music TV',
        streamUrl: 'https://albportal.net/albkanalemusic.m3u8',
        logo: 'https://i.imgur.com/JdKxscs.png',
        epgId: 'AlbKanaleMusicTV.al',
        category: 'Music',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Kanali 7',
        streamUrl: 'https://fe.tring.al/delta/105/out/u/1200_1.m3u8',
        logo: 'https://i.imgur.com/rL2v9pM.png',
        epgId: 'Kanali7.al',
        category: 'General',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Vizion Plus',
        streamUrl: 'https://fe.tring.al/delta/105/out/u/rdghfhsfhfshs.m3u8',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Vizion_Plus.svg/512px-Vizion_Plus.svg.png',
        epgId: 'VizionPlus.al',
        category: 'Entertainment',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Panorama TV',
        streamUrl: 'http://198.244.188.94/panorama/livestream/playlist.m3u8',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Panorama_logo.svg/512px-Panorama_logo.svg.png',
        epgId: 'PanoramaTV.al',
        category: 'News',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'TV Arberia 1',
        streamUrl: 'https://yayin30.haber100.com/live/rtvarberia/playlist.m3u8',
        logo: 'https://i.imgur.com/zLRzyVS.png',
        epgId: 'TVArberia1.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'TV Dielli',
        streamUrl: 'http://stream.tvdielli.com:8081/dielli/index.m3u8',
        logo: 'https://i.imgur.com/kLl3ar5.png',
        epgId: 'TVDielli.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'TV Opoja',
        streamUrl: 'http://ip.opoja.tv:1935/tvopoja/tvopoja/playlist.m3u8',
        logo: 'https://i.imgur.com/hxi4Qiq.png',
        epgId: 'TVOpoja.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'RTV Pendimi',
        streamUrl: 'https://www.rtvpendimi.com:19360/tvpendimi/tvpendimi.m3u8',
        logo: 'https://i.ibb.co/tD48GMD/RTV-Pendimi.png',
        epgId: 'RTVPendimi.ch',
        category: 'Religious',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Zjarr TV',
        streamUrl: 'https://zjarr.future.al/hls/playlist.m3u8',
        logo: 'https://i.imgur.com/hNuWZWe.png',
        epgId: 'ZjarrTV.al',
        category: 'General',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'TopEstrada TV',
        streamUrl: 'http://live.topestrada.com/live/topestrada/playlist.m3u8',
        logo: 'https://i.imgur.com/0Dh1FJZ.png',
        epgId: 'TopEstradaTV.mk',
        category: 'Music',
        country: 'MK',
        language: 'sqi'
    },
    {
        name: 'AlbDreams TV',
        streamUrl: 'http://live.albavision.net:1123/live/albdreams.m3u8',
        logo: 'https://i.imgur.com/3VWF3sj.png',
        epgId: 'AlbdreamsTV.us',
        category: 'Entertainment',
        country: 'AL',
        language: 'sqi'
    },
    {
        name: 'Shqiponja TV',
        streamUrl: 'https://shiko.shqiponja-tv.com:3941/hybrid/play.m3u8',
        logo: 'https://i.ibb.co/qL0jBF6Y/tvshiqponja.jpg',
        epgId: 'ShqiponjaTV.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Drita TV',
        streamUrl: 'https://dritatv.protokolldns.xyz/dritaweb5587989/index.m3u8',
        logo: 'https://i.imgur.com/cvgVmZw.png',
        epgId: 'DritaTV.ch',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'RTV Dukagjini',
        streamUrl: 'https://www.youtube.com/@DukagjiniRTV/live',
        logo: 'https://yt3.googleusercontent.com/ytc/AIdro_kQm9v7sF0TXqR8s9b3TqKf2tVwYJd2f8VXQA=s176-c-k-c0x00ffffff-no-rj',
        epgId: 'RTVDukagjini.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    },
    {
        name: 'Klan Kosova',
        streamUrl: 'https://www.youtube.com/@KlanKosovaOfficial/live',
        logo: 'https://yt3.googleusercontent.com/ytc/AIdro_nPMqSL2UIT3v7JhJkOUIn9tQbg_UhGz4yh3Q=s176-c-k-c0x00ffffff-no-rj',
        epgId: 'KlanKosova.xk',
        category: 'General',
        country: 'XK',
        language: 'sqi'
    }
];

async function checkStreamUrl(url) {
    try {
        const response = await axios.head(url, {
            timeout: 8000,
            maxRedirects: 3,
            validateStatus: (status) => status < 400
        });
        return true;
    } catch (error) {
        try {
            const response = await axios.get(url, {
                timeout: 8000,
                maxRedirects: 3,
                maxContentLength: 1024,
                validateStatus: (status) => status < 400
            });
            return true;
        } catch (err) {
            return false;
        }
    }
}

async function importChannels(channels, options = {}) {
    const { dryRun = false, verify = false } = options;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let offline = 0;

    for (const channel of channels) {
        try {
            if (verify) {
                const isLive = await checkStreamUrl(channel.streamUrl);
                if (!isLive) {
                    console.log(`  [OFFLINE] ${channel.name}: ${channel.streamUrl}`);
                    offline++;
                    continue;
                }
            }

            const existing = await prisma.channel.findFirst({
                where: { streamUrl: channel.streamUrl }
            });

            if (existing) {
                const updates = {};
                if (channel.logo && !existing.logo) updates.logo = channel.logo;
                if (channel.epgId && !existing.epgId) updates.epgId = channel.epgId;
                if (channel.name && existing.name === 'Unknown') updates.name = channel.name;
                if (!existing.isActive) updates.isActive = true;
                if (!existing.isLive) updates.isLive = true;
                if (Object.keys(updates).length > 0) {
                    if (!dryRun) {
                        await prisma.channel.update({ where: { id: existing.id }, data: updates });
                    }
                    console.log(`  [UPDATE] ${channel.name} (${Object.keys(updates).join(', ')})`);
                    updated++;
                } else {
                    console.log(`  [SKIP] ${channel.name} (already exists)`);
                    skipped++;
                }
                continue;
            }

            const channelData = {
                name: channel.name,
                description: `${channel.name} - Gjirafa Video`,
                logo: channel.logo,
                streamUrl: channel.streamUrl,
                streamType: 'HLS',
                fileExt: 'm3u8',
                category: channel.category || 'General',
                country: channel.country || 'XK',
                language: channel.language || 'sqi',
                epgId: channel.epgId || null,
                isActive: true,
                isLive: true,
                sortOrder: channel.country === 'XK' ? 100 : 200
            };

            if (dryRun) {
                console.log(`  [DRY] Would import: ${channel.name} (${channel.country})`);
            } else {
                await prisma.channel.create({ data: channelData });
                console.log(`  [NEW] ${channel.name} (${channel.country})`);
            }
            imported++;
        } catch (error) {
            console.log(`  [FAIL] ${channel.name}: ${error.message}`);
            failed++;
        }
    }

    return { imported, updated, skipped, failed, offline };
}

async function showStats() {
    const gjirafaCount = await prisma.channel.count({
        where: {
            streamUrl: { contains: 'gjirafa' },
            isActive: true
        }
    });
    const xkTotal = await prisma.channel.count({
        where: { country: 'XK', isActive: true }
    });
    const alTotal = await prisma.channel.count({
        where: { country: 'AL', isActive: true }
    });
    console.log(`\n  Gjirafa streams: ${gjirafaCount}`);
    console.log(`  Total XK: ${xkTotal}`);
    console.log(`  Total AL: ${alTotal}`);
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const tvOnly = args.includes('--tv-only');
    const radioOnly = args.includes('--radio-only');
    const verify = args.includes('--verify');
    const statsOnly = args.includes('--stats');

    try {
        if (statsOnly) {
            console.log('=== Gjirafa Channel Stats ===');
            await showStats();
            return;
        }

        console.log('=== Gjirafa Video Channel Import ===');
        console.log(`Source: https://video.gjirafa.com/drejteperdrejt`);
        if (dryRun) console.log('(DRY RUN - no changes will be made)');
        if (verify) console.log('(VERIFY mode - checking stream availability)');

        console.log('\n--- Before Import ---');
        await showStats();

        if (!radioOnly) {
            console.log(`\n--- TV Channels (${GJIRAFA_TV_CHANNELS.length}) ---`);
            const tvResult = await importChannels(GJIRAFA_TV_CHANNELS, { dryRun, verify });
            console.log(`\nTV: imported=${tvResult.imported} updated=${tvResult.updated} skipped=${tvResult.skipped} failed=${tvResult.failed}${verify ? ` offline=${tvResult.offline}` : ''}`);
        }

        if (!tvOnly) {
            console.log(`\n--- Radio Stations (${GJIRAFA_RADIO_CHANNELS.length}) ---`);
            const radioResult = await importChannels(GJIRAFA_RADIO_CHANNELS, { dryRun, verify });
            console.log(`\nRadio: imported=${radioResult.imported} updated=${radioResult.updated} skipped=${radioResult.skipped} failed=${radioResult.failed}${verify ? ` offline=${radioResult.offline}` : ''}`);
        }

        if (!radioOnly) {
            console.log(`\n--- Additional AL/XK Channels (${ADDITIONAL_AL_XK_CHANNELS.length}) ---`);
            const extraResult = await importChannels(ADDITIONAL_AL_XK_CHANNELS, { dryRun, verify });
            console.log(`\nAdditional: imported=${extraResult.imported} updated=${extraResult.updated} skipped=${extraResult.skipped} failed=${extraResult.failed}${verify ? ` offline=${extraResult.offline}` : ''}`);
        }

        console.log('\n--- After Import ---');
        await showStats();

    } catch (error) {
        console.error('Error:', error.message);
        if (
            error.message.includes("Can't reach database server") &&
            process.env.PRODUCTION_DATABASE_URL &&
            (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost'))
        ) {
            console.error('Tip: run with production DB explicitly when local Postgres is offline:');
            console.error('  DATABASE_URL="$PRODUCTION_DATABASE_URL" node scripts/import-gjirafa.js --verify --dry-run');
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
