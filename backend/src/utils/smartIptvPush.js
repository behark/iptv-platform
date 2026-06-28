/**
 * Smart IPTV Auto-Push Utility
 *
 * Note: siptv.app uses Cloudflare Turnstile captcha which blocks server-side requests.
 * The push is attempted but expected to fail — the frontend provides a one-click fallback.
 */

const SIPTV_UPLOAD_URL = 'https://siptv.app/scripts/up_file_url.php';

/**
 * Attempt to push a playlist URL to Smart IPTV service for a given MAC address.
 * @param {string} mac - Device MAC address (e.g. "A0:D7:F3:98:64:58")
 * @param {string} playlistUrl - The M3U playlist URL
 * @param {string} [epgUrl] - Optional EPG URL
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function pushToSmartIptv(mac, playlistUrl, epgUrl) {
  try {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="mac"\r\n\r\n${mac}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="url1"\r\n\r\n${playlistUrl}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="url_count"\r\n\r\n1`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file_selected"\r\n\r\n0`,
      `--${boundary}\r\nContent-Disposition: form-data; name="epg_count"\r\n\r\n${epgUrl ? '1' : '0'}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="plist_order"\r\n\r\n0`,
      `--${boundary}\r\nContent-Disposition: form-data; name="lang"\r\n\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="submit"\r\n\r\nSend`,
    ];
    if (epgUrl) {
      parts.splice(2, 0, `--${boundary}\r\nContent-Disposition: form-data; name="epg1"\r\n\r\n${epgUrl}`);
    }
    const body = parts.join('\r\n') + `\r\n--${boundary}--\r\n`;

    // Hard timeout so a slow/hanging siptv.app can never block device activation.
    // This runs in the request path on a serverless function with a limited time
    // budget; without it, a stalled upload would tip activation into a 500.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    let text;
    try {
      const response = await fetch(SIPTV_UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': 'https://siptv.app/mylist/',
          'Origin': 'https://siptv.app',
          'Cookie': 'origin=valid; captcha2=1',
        },
        body,
        signal: controller.signal,
      });

      text = await response.text();
    } finally {
      clearTimeout(timeout);
    }
    const successIndicators = ['success', 'uploaded', 'added'];
    const failIndicators = ['reload the page', 'not found', 'not activated', 'captcha', 'recaptcha'];

    const hasSuccess = successIndicators.some(s => text.toLowerCase().includes(s));
    const hasFail = failIndicators.some(s => text.toLowerCase().includes(s));

    if (hasSuccess && !hasFail) {
      console.log(`[SmartIPTV] Playlist pushed for MAC ${mac}`);
      return { success: true, message: 'Playlist uploaded to Smart IPTV' };
    } else {
      console.warn(`[SmartIPTV] Push failed for MAC ${mac}: ${text.substring(0, 200)}`);
      return { success: false, message: 'Captcha required — use the button to upload via browser' };
    }
  } catch (error) {
    console.error(`[SmartIPTV] Push error for MAC ${mac}:`, error.message);
    return { success: false, message: `Smart IPTV push failed: ${error.message}` };
  }
}

module.exports = { pushToSmartIptv };
