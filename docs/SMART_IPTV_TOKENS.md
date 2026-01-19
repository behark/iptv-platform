# Smart IPTV Tokens

Use these values when adding the Smart IPTV playlist/EPG via URL:

```
Playlist URL:
https://iptv-platform-2n8t.onrender.com/api/exports/m3u?token=2184bce3036c2d7f2f88a7b51d5d3ba6bb5d5941fd70297109b801e6109c1c50&mac=90%3AF1%3AAA%3A14%3AD7%3A52

EPG XML URL:
https://iptv-platform-2n8t.onrender.com/api/exports/epg.xml?token=2184bce3036c2d7f2f88a7b51d5d3ba6bb5d5941fd70297109b801e6109c1c50&mac=90%3AF1%3AAA%3A14%3AD7%3A52
```

Token lifetime: 7 days (default `JWT_EXPIRE=7d`).

If Smart IPTV still reports no channels, verify the app is requesting the same MAC (`90:F1:AA:14:D7:52`). If the MAC is altered, rerun GET `/api/exports/playlist-token?mac=<the-mac>` to regenerate URLs.
