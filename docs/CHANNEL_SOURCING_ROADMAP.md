# IPTV Channel Sourcing Roadmap

## Executive Summary

This roadmap outlines strategies to source channels for your IPTV platform, prioritizing **free and low-cost options** while maintaining legal compliance. The goal is to offer competitive subscription pricing (e.g., $50/year) with a large channel catalog.

---

## Table of Contents

1. [Free & Legal Channel Sources](#1-free--legal-channel-sources)
2. [Low-Cost Channel Aggregators](#2-low-cost-channel-aggregators)
3. [Technical Implementation](#3-technical-implementation)
4. [Pricing Strategy](#4-pricing-strategy)
5. [Legal Considerations](#5-legal-considerations)
6. [Implementation Timeline](#6-implementation-timeline)
7. [Cost Analysis](#7-cost-analysis)

---

## 1. Free & Legal Channel Sources

### 1.1 Public M3U Playlist Repositories (FREE)

These are community-maintained playlists with legal, free-to-air channels:

| Source | Channels | Description | URL |
|--------|----------|-------------|-----|
| **iptv-org/iptv** | 8,000+ | Largest free legal IPTV collection | github.com/iptv-org/iptv |
| **Free-TV/IPTV** | 3,000+ | Curated free channels | github.com/Free-TV/IPTV |
| **iptv-org/database** | 10,000+ | Channel database with metadata | github.com/iptv-org/database |
| **Pluto.tv** | 250+ | Free ad-supported streaming | pluto.tv |
| **Samsung TV Plus** | 200+ | Free streaming channels | samsung.com/tvplus |

**Implementation Priority: HIGH** - Start here, completely free!

### 1.2 Free-to-Air (FTA) Satellite Channels

Free broadcast channels available via satellite:

| Region | Satellites | Channels | Notes |
|--------|-----------|----------|-------|
| Europe | Astra 19.2E, Hotbird 13E | 1,000+ | Many unencrypted |
| North America | Galaxy 19 | 500+ | FTA religious, ethnic |
| Middle East | Nilesat, Arabsat | 800+ | Arabic FTA channels |
| Asia | Thaicom, AsiaSat | 600+ | Asian FTA channels |

**Cost**: One-time satellite receiver (~$100-300) + restreaming server

### 1.3 Official Free Streaming Services (Legal)

| Service | Type | Channels | Integration |
|---------|------|----------|-------------|
| **Pluto TV** | FAST | 250+ | API available |
| **Tubi** | VOD/Live | 100+ | Web scraping (check ToS) |
| **Plex Free** | FAST | 180+ | Limited API |
| **Roku Channel** | FAST | 300+ | Roku devices only |
| **Xumo** | FAST | 200+ | API inquiry needed |
| **Peacock Free** | Streaming | Limited | NBC content |
| **Crackle** | VOD | Movies/Shows | Free tier |

**FAST = Free Ad-Supported Streaming Television**

### 1.4 YouTube Live Streams (FREE)

Many news and entertainment channels stream 24/7 on YouTube:

- **News**: Sky News, Al Jazeera, France 24, DW, NHK World
- **Music**: Lofi Girl, ChilledCow, MTV Classic streams
- **Sports**: Olympic Channel, Red Bull TV
- **Religious**: Various 24/7 streams

**Tool**: youtube-dl / yt-dlp to extract stream URLs

---

## 2. Low-Cost Channel Aggregators

### 2.1 Reseller/Panel Providers (Budget Option)

> ⚠️ **Legal Warning**: Many reseller panels distribute pirated content. Only use legitimate providers.

**Legitimate Reseller Options:**

| Provider Type | Cost/Month | Channels | Legality |
|---------------|------------|----------|----------|
| FAST Aggregators | $50-200 | 500-2000 | Legal |
| Regional Broadcasters | $100-500 | 50-200 | Licensed |
| Ethnic/Niche Providers | $50-150 | 100-500 | Usually legal |

### 2.2 Content Licensing (Professional Route)

| License Type | Cost | Channels | Best For |
|--------------|------|----------|----------|
| **Per-channel license** | $0.01-0.10/sub/month | 1 channel | Premium content |
| **Bundle license** | $500-5000/month | 50-200 | Regional packages |
| **White-label IPTV** | $1000-5000/month | 1000+ | Full service |

### 2.3 Recommended Budget Providers

**For Ethnic/International Content:**

1. **Tashan IPTV** - South Asian content (legitimate)
2. **YuppTV** - Indian channels (licensed)
3. **Sling International** - Multi-language packs
4. **FuboTV Latino** - Spanish content

**For African Content:**

1. **StarTimes** - Pan-African licensed
2. **DStv Now** - African broadcaster (licensing available)

---

## 3. Technical Implementation

### 3.1 Channel Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your IPTV Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Free M3U  │  │  FTA Sats   │  │  Licensed   │         │
│  │  Playlists  │  │  Streams    │  │  Content    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌──────────────────────────────────────────────────┐      │
│  │           Channel Aggregator Service              │      │
│  │  - Stream validation                              │      │
│  │  - Health monitoring                              │      │
│  │  - Auto-failover                                  │      │
│  │  - EPG synchronization                            │      │
│  └──────────────────────────────────────────────────┘      │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────┐      │
│  │              Media Server / CDN                   │      │
│  │  - HLS transcoding                                │      │
│  │  - Adaptive bitrate                               │      │
│  │  - Geographic distribution                        │      │
│  └──────────────────────────────────────────────────┘      │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────┐      │
│  │              Your Backend (Node.js)               │      │
│  │  - User authentication                            │      │
│  │  - Subscription management                        │      │
│  │  - Channel access control                         │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 M3U Playlist Auto-Importer

Create a service to automatically import and validate channels:

```javascript
// backend/src/services/channelImporter.js

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FREE_SOURCES = [
  {
    name: 'iptv-org',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    category: 'International'
  },
  {
    name: 'iptv-org-countries',
    url: 'https://iptv-org.github.io/iptv/index.country.m3u',
    category: 'By Country'
  },
  {
    name: 'iptv-org-languages', 
    url: 'https://iptv-org.github.io/iptv/index.language.m3u',
    category: 'By Language'
  }
];

async function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  let currentChannel = null;

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/tvg-id="([^"]*)".*tvg-name="([^"]*)".*tvg-logo="([^"]*)".*group-title="([^"]*)",(.+)/);
      if (match) {
        currentChannel = {
          epgId: match[1] || null,
          name: match[2] || match[5],
          logo: match[3] || null,
          category: match[4] || 'Uncategorized',
          description: match[5]
        };
      }
    } else if (line.startsWith('http') && currentChannel) {
      currentChannel.streamUrl = line.trim();
      currentChannel.streamType = line.includes('.m3u8') ? 'HLS' : 'DIRECT';
      channels.push(currentChannel);
      currentChannel = null;
    }
  }

  return channels;
}

async function validateStream(url, timeout = 5000) {
  try {
    const response = await axios.head(url, { timeout });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function importChannels(source, validateStreams = false) {
  console.log(`Importing from ${source.name}...`);
  
  const response = await axios.get(source.url);
  const channels = await parseM3U(response.data);
  
  let imported = 0;
  let failed = 0;

  for (const channel of channels) {
    try {
      // Optional: validate stream is working
      if (validateStreams) {
        const isValid = await validateStream(channel.streamUrl);
        if (!isValid) {
          failed++;
          continue;
        }
      }

      await prisma.channel.upsert({
        where: { 
          name_streamUrl: { 
            name: channel.name, 
            streamUrl: channel.streamUrl 
          } 
        },
        update: {
          logo: channel.logo,
          category: channel.category,
          isActive: true
        },
        create: {
          name: channel.name,
          description: channel.description || channel.name,
          logo: channel.logo,
          streamUrl: channel.streamUrl,
          streamType: channel.streamType,
          category: channel.category,
          epgId: channel.epgId,
          isActive: true,
          isLive: true
        }
      });
      imported++;
    } catch (error) {
      console.error(`Failed to import ${channel.name}:`, error.message);
      failed++;
    }
  }

  console.log(`Imported: ${imported}, Failed: ${failed}`);
  return { imported, failed };
}

async function importAllSources() {
  for (const source of FREE_SOURCES) {
    await importChannels(source);
  }
}

module.exports = { importChannels, importAllSources, FREE_SOURCES };
```

### 3.3 EPG (Electronic Program Guide) Integration

Free EPG sources:

| Source | Coverage | Format | URL |
|--------|----------|--------|-----|
| **iptv-org/epg** | Global | XMLTV | github.com/iptv-org/epg |
| **xmltv.net** | Europe | XMLTV | xmltv.net |
| **zap2it** | USA | JSON | zap2it.com |

```javascript
// backend/src/services/epgImporter.js

const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EPG_SOURCES = [
  'https://iptv-org.github.io/epg/guides/us/tvguide.com.epg.xml.gz',
  'https://iptv-org.github.io/epg/guides/uk/sky.com.epg.xml.gz',
  'https://iptv-org.github.io/epg/guides/de/horizon.tv.epg.xml.gz'
];

async function importEPG(epgUrl) {
  const response = await axios.get(epgUrl, { responseType: 'arraybuffer' });
  // Handle gzip decompression if needed
  const xmlData = await parseStringPromise(response.data);
  
  const programs = xmlData.tv.programme || [];
  
  for (const program of programs) {
    const channelId = program.$.channel;
    const start = new Date(program.$.start);
    const stop = new Date(program.$.stop);
    const title = program.title?.[0]?._ || program.title?.[0];
    const description = program.desc?.[0]?._ || program.desc?.[0];

    await prisma.ePGEntry.create({
      data: {
        channelId,
        title,
        description,
        startTime: start,
        endTime: stop
      }
    });
  }
}

module.exports = { importEPG, EPG_SOURCES };
```

### 3.4 Stream Health Monitor

```javascript
// backend/src/services/streamMonitor.js

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStreamHealth(channel) {
  try {
    const start = Date.now();
    const response = await axios.head(channel.streamUrl, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IPTV-Health-Check/1.0)'
      }
    });
    const latency = Date.now() - start;

    return {
      isOnline: response.status === 200,
      latency,
      lastChecked: new Date()
    };
  } catch (error) {
    return {
      isOnline: false,
      latency: null,
      error: error.message,
      lastChecked: new Date()
    };
  }
}

async function monitorAllChannels() {
  const channels = await prisma.channel.findMany({
    where: { isActive: true }
  });

  const results = [];
  
  for (const channel of channels) {
    const health = await checkStreamHealth(channel);
    
    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        isActive: health.isOnline,
        updatedAt: new Date()
      }
    });

    results.push({ channel: channel.name, ...health });
  }

  return results;
}

// Run every 30 minutes
function startMonitoring() {
  setInterval(monitorAllChannels, 30 * 60 * 1000);
  console.log('Stream health monitoring started');
}

module.exports = { checkStreamHealth, monitorAllChannels, startMonitoring };
```

---

## 4. Pricing Strategy

### 4.1 Competitive Analysis

| Competitor | Price/Year | Channels | Your Advantage |
|------------|------------|----------|----------------|
| Typical IPTV | $50-100 | 10,000-20,000 | Often illegal, unreliable |
| Netflix | $180-240 | N/A (VOD) | No live TV |
| Hulu + Live | $900+ | 75+ | Very expensive |
| YouTube TV | $780 | 100+ | Limited international |

### 4.2 Recommended Pricing Tiers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRICING STRUCTURE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FREE TIER                          $0/month                │
│  ├─ 500+ Free channels (FTA, FAST)                          │
│  ├─ Ad-supported                                             │
│  ├─ SD quality                                               │
│  └─ Limited DVR                                              │
│                                                              │
│  BASIC PLAN                         $4.99/month ($49/year)  │
│  ├─ 2,000+ channels                                          │
│  ├─ No ads                                                   │
│  ├─ HD quality                                               │
│  ├─ 2 simultaneous streams                                   │
│  └─ 24-hour DVR                                              │
│                                                              │
│  PREMIUM PLAN                       $8.99/month ($89/year)  │
│  ├─ 5,000+ channels                                          │
│  ├─ 4K quality (where available)                             │
│  ├─ 4 simultaneous streams                                   │
│  ├─ 7-day DVR                                                │
│  ├─ VOD library                                              │
│  └─ Premium sports add-ons                                   │
│                                                              │
│  FAMILY PLAN                        $14.99/month ($149/year)│
│  ├─ Everything in Premium                                    │
│  ├─ 8,000+ channels                                          │
│  ├─ 6 simultaneous streams                                   │
│  ├─ 30-day DVR                                               │
│  ├─ Kids profiles                                            │
│  └─ Parental controls                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Revenue Model

**Cost Structure (Per 1,000 Users):**

| Item | Monthly Cost | Notes |
|------|--------------|-------|
| Server/CDN | $200-500 | Scales with usage |
| Bandwidth | $100-300 | ~2TB/user/month |
| Licensed Content | $0-500 | Depends on deals |
| EPG Services | $0-50 | Free sources available |
| Support | $100-200 | Part-time support |
| **Total** | **$400-1,550** | |

**Revenue (Per 1,000 Users at $5/month avg):**
- Monthly: $5,000
- Costs: ~$1,000
- **Profit: ~$4,000/month**

---

## 5. Legal Considerations

### 5.1 Legal Channel Sources Only

✅ **LEGAL:**
- Free-to-air satellite channels
- Official FAST services (Pluto, Tubi, etc.)
- Licensed content with proper agreements
- User-generated content platforms
- Public domain content

❌ **ILLEGAL (AVOID):**
- Restreaming paid channels without license
- "IPTV reseller panels" with pirated content
- Cracked/modified streams
- Geo-unlocking paid services

### 5.2 Required Legal Documents

1. **Terms of Service** - User agreements
2. **Privacy Policy** - GDPR/CCPA compliance
3. **DMCA Policy** - Takedown procedures
4. **Content Licensing Agreements** - For any paid content

### 5.3 Business Structure Recommendations

| Structure | Best For | Notes |
|-----------|----------|-------|
| LLC | US-based | Liability protection |
| Ltd | UK/EU | European operations |
| Offshore | International | Consider legal implications |

---

## 6. Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up M3U importer for free sources
- [ ] Import iptv-org channels (~8,000)
- [ ] Implement stream health monitoring
- [ ] Basic EPG integration

### Phase 2: Expansion (Weeks 3-4)
- [ ] Add FTA satellite restreaming (if applicable)
- [ ] Integrate FAST services (Pluto, etc.)
- [ ] Implement channel categories/filtering
- [ ] Launch free tier

### Phase 3: Monetization (Weeks 5-6)
- [ ] Implement subscription tiers
- [ ] Add premium channel sources
- [ ] Set up payment processing
- [ ] Launch paid tiers

### Phase 4: Growth (Weeks 7-8)
- [ ] Regional content expansion
- [ ] VOD integration
- [ ] Mobile apps
- [ ] Marketing launch

---

## 7. Cost Analysis

### 7.1 Startup Costs (Minimum Viable Product)

| Item | One-Time Cost | Monthly Cost |
|------|---------------|--------------|
| Domain | $15 | - |
| SSL Certificate | Free (Let's Encrypt) | - |
| VPS (4GB RAM) | - | $20-40 |
| CDN (Cloudflare) | Free tier | $0-20 |
| Database (Supabase) | Free tier | $0-25 |
| **Total** | **$15** | **$20-85** |

### 7.2 Scaling Costs

| Users | Server | Bandwidth | Total/Month |
|-------|--------|-----------|-------------|
| 100 | $40 | $20 | $60 |
| 1,000 | $150 | $200 | $350 |
| 10,000 | $500 | $2,000 | $2,500 |
| 100,000 | $2,000 | $15,000 | $17,000 |

---

## 8. Quick Start Checklist

### Immediate Actions (Today)

- [ ] Clone iptv-org/iptv repository
- [ ] Run the channel importer script (see Section 3.2)
- [ ] Verify streams are working
- [ ] Set up EPG for popular channels

### This Week

- [ ] Categorize channels by country/language
- [ ] Remove non-working streams
- [ ] Set up automated health monitoring
- [ ] Create subscription plans in Stripe

### This Month

- [ ] Launch with 5,000+ working channels
- [ ] Implement free tier with ads
- [ ] Begin paid subscription signups
- [ ] Gather user feedback

---

## 9. Resources

### GitHub Repositories
- https://github.com/iptv-org/iptv - Main channel source
- https://github.com/iptv-org/epg - EPG data
- https://github.com/iptv-org/database - Channel metadata

### Tools
- **FFmpeg** - Stream transcoding
- **Nginx-RTMP** - Restreaming server
- **yt-dlp** - YouTube stream extraction

### Documentation
- M3U Format: https://en.wikipedia.org/wiki/M3U
- HLS Specification: https://developer.apple.com/streaming/
- XMLTV Format: http://wiki.xmltv.org/

---

## Summary

**Start with 8,000+ FREE legal channels from iptv-org, then:**

1. **Week 1**: Import free M3U playlists, get 5,000+ working channels
2. **Week 2**: Add EPG and stream monitoring
3. **Week 3**: Launch free tier (ad-supported)
4. **Week 4**: Launch $49/year basic plan
5. **Month 2**: Add premium content, reach 10,000+ channels
6. **Month 3**: Scale marketing, add regional content

**Projected costs**: $20-100/month to start
**Projected revenue**: $5,000+/month at 1,000 paid users

---

*Document Version: 1.0*
*Last Updated: January 2026*
