/**
 * Smart IPTV Auto-Push Utility
 * Automatically uploads playlist URL to siptv.app/mylist when a device is activated.
 */

const SIPTV_UPLOAD_URL = 'https://siptv.app/mylist/';

/**
 * Push a playlist URL to Smart IPTV service for a given MAC address.
 * @param {string} mac - Device MAC address (e.g. "A0:D7:F3:98:64:58")
 * @param {string} playlistUrl - The M3U playlist URL
 * @param {string} [epgUrl] - Optional EPG URL
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function pushToSmartIptv(mac, playlistUrl, epgUrl) {
  try {
    const formData = new URLSearchParams();
    formData.append('mac', mac);
    formData.append('url', playlistUrl);
    if (epgUrl) {
      formData.append('epg', epgUrl);
    }

    const response = await fetch(SIPTV_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'IPTV-Platform/1.0',
      },
      body: formData.toString(),
    });

    const text = await response.text();

    // siptv.app returns HTML — check for success indicators
    const isSuccess = response.ok && (
      text.toLowerCase().includes('success') ||
      text.toLowerCase().includes('uploaded') ||
      !text.toLowerCase().includes('error')
    );

    if (isSuccess) {
      console.log(`[SmartIPTV] Playlist pushed for MAC ${mac}`);
      return { success: true, message: 'Playlist uploaded to Smart IPTV' };
    } else {
      console.warn(`[SmartIPTV] Push may have failed for MAC ${mac}: ${text.substring(0, 200)}`);
      return { success: false, message: 'Smart IPTV upload may have failed' };
    }
  } catch (error) {
    console.error(`[SmartIPTV] Push error for MAC ${mac}:`, error.message);
    return { success: false, message: `Smart IPTV push failed: ${error.message}` };
  }
}

module.exports = { pushToSmartIptv };
