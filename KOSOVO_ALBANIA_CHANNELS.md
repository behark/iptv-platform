# Free Legal Kosovo/Albanian IPTV Channels - Sources Guide

This document provides information about where to find free, legal Kosovo and Albanian TV channels for your IPTV platform.

## Quick Import

You can now import Kosovo and Albanian channels directly using the importer:

```bash
# Import Albanian channels (18 channels)
node backend/scripts/import-channels.js country al

# Import Kosovo channels (13 channels)
node backend/scripts/import-channels.js country xk

# Import both
node backend/scripts/import-channels.js country al && node backend/scripts/import-channels.js country xk
```

## Primary Sources

### 1. IPTV-org (Already Integrated)
- **Albania**: https://iptv-org.github.io/iptv/countries/al.m3u (18 channels)
- **Kosovo**: https://iptv-org.github.io/iptv/countries/xk.m3u (13 channels)
- **Status**: ✅ Already added to your importer
- **Quality**: High - regularly maintained, legal streams
- **Channels include**: News, Entertainment, Music, Kids channels

### 2. Official Broadcasters (Direct Sources)

#### Albanian Channels
- **RTSh (Radio Televizioni Shqiptar)**: 
  - Official website: https://www.rtsh.al/
  - May have live streaming on their website
  
- **Top Channel Albania**:
  - Official website: https://top-channel.tv/
  - Check for live streaming options

- **Vizion Plus**:
  - Official website: https://www.vizionplus.tv/
  - May offer live streaming

- **Klan TV**:
  - Official website: https://www.klan.al/
  - Check for live streaming

#### Kosovo Channels
- **RTK (Radio Televizioni i Kosovës)**:
  - Official website: https://www.rtklive.com/
  - Public broadcaster, may have official streams

- **KTV (Koha Vision)**:
  - Official website: https://www.ktv.tv/
  - Check for live streaming

- **RTV21**:
  - Official website: https://www.rtv21.tv/
  - May offer live streaming

## Additional Free Sources

### 3. Public Broadcasting Archives
- **European Broadcasting Union (EBU)**: 
  - Some public broadcasters share streams through EBU
  - Check: https://www.ebu.ch/

### 4. YouTube Live Streams
Many Kosovo and Albanian channels have official YouTube live streams:
- Search for "Albanian TV live" or "Kosovo TV live" on YouTube
- Look for verified channel badges to ensure legitimacy
- Channels like RTK, RTV21, Top Channel may have official YouTube streams

### 5. Official Mobile Apps
Many broadcasters offer free live streaming through their mobile apps:
- Check official app stores for broadcaster apps
- Some may provide M3U8 stream URLs that can be extracted

### 6. Satellite/Cable Provider Streams
Some legal IPTV services aggregate free-to-air channels:
- **Freesat** (if available in region)
- **Freeview** (if available in region)
- Check local cable providers for free channel lists

## How to Add New Channels

### Method 1: Using the Importer Script
```bash
# Import from a custom M3U URL
node backend/scripts/import-channels.js url <M3U_URL>

# Import from a local M3U file
node backend/scripts/import-channels.js file <path-to-file.m3u>
```

### Method 2: Manual Addition
1. Find the stream URL (usually ends in `.m3u8` or `.m3u`)
2. Verify it's legal and publicly available
3. Add it to your database manually or through the admin interface

## Legal Considerations

⚠️ **Important**: Always ensure channels are:
- ✅ Legally available for streaming
- ✅ Publicly accessible (not behind paywalls)
- ✅ Not geo-restricted in ways that violate terms
- ✅ From official sources or authorized distributors

## Channel Discovery Tips

1. **Check Official Websites**: Most broadcasters list their live streaming options
2. **Look for "Watch Live" or "Live Stream" sections**
3. **Inspect Network Traffic**: Use browser dev tools to find M3U8 URLs
4. **Check GitHub**: Search for "albania m3u" or "kosovo m3u" repositories
5. **IPTV Community Forums**: Some communities share legal free channel lists

## Current Channel Count

- **Albania (AL)**: 18 channels available from iptv-org
- **Kosovo (XK)**: 13 channels available from iptv-org
- **Total**: 31 channels currently available

## Contributing New Sources

If you find additional legal sources:
1. Verify the source is legal and free
2. Test the stream URL works
3. Add it to the appropriate M3U file or database
4. Document the source in this file

## Useful Resources

- [IPTV-org Repository](https://github.com/iptv-org/iptv) - Main source for free IPTV channels
- [LyngSat](https://www.lyngsat.com/) - Satellite TV channel database
- [KingOfSat](https://en.kingofsat.net/) - European satellite channel directory

## Notes

- Stream URLs may change over time - regular updates recommended
- Some channels may have geographic restrictions
- Quality and availability may vary by channel
- Always respect copyright and terms of service
