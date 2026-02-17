const axios = require('axios');
const cheerio = require('cheerio');

function decodeCloudTVEUrl(dataUrl) {
  if (!dataUrl) return null;
  const withoutPrefix = dataUrl.replace('/cors-free/', '');
  const slashIdx = withoutPrefix.indexOf('/');
  if (slashIdx === -1) return null;
  const encodedHost = withoutPrefix.substring(0, slashIdx);
  const pathPart = withoutPrefix.substring(slashIdx);
  try {
    const decoded = encodedHost.split(':').map(c => String.fromCharCode(parseInt(c, 10))).join('');
    if (!decoded) return null;
    const url = decoded.startsWith('http://') || decoded.startsWith('https://')
      ? decoded + pathPart
      : 'https://' + decoded + pathPart;
    new URL(url);
    return url;
  } catch { return null; }
}

(async () => {
  const { data: html } = await axios.get('https://cloudtve.com', { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(html);
  let count = 0;
  $('button.watchBtn').each((_, el) => {
    if (count >= 5) return false;
    const btn = $(el);
    const raw = btn.attr('data-url');
    const decoded = decodeCloudTVEUrl(raw);
    console.log(btn.attr('data-name'), '->', decoded);
    count++;
  });
})();
