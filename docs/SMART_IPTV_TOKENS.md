# Smart IPTV Tokens

Smart IPTV now supports short redirects, so you only need to supply the MAC:

```
Playlist URL:
https://iptv-platform-2n8t.onrender.com/tv/playlist/90:f1:aa:14:d7:52

EPG URL:
https://iptv-platform-2n8t.onrender.com/tv/epg/90:f1:aa:14:d7:52
```

The redirect internally generates the playlist token (and keeps it bound to `90:f1:aa:14:d7:52`), so no manual JWT is required. Tokens still expire after 7 days (default `JWT_EXPIRE=7d`) and are reissued automatically when the redirect is hit.

If Smart IPTV still refuses to load the list, double-check that the device reports the same lowercase MAC (`90:f1:aa:14:d7:52`). If the app uppercases or strips colons, call `GET /api/exports/playlist-token?mac=<their-mac>` once and use the returned token-bearing URL.
