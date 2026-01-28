/**
 * YouTube Service
 * Searches for videos with Albanian captions available
 *
 * API Docs: https://developers.google.com/youtube/v3/docs
 */

const axios = require('axios');

const API_BASE = 'https://www.googleapis.com/youtube/v3';

class YouTubeService {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY;
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Search for videos
   * @param {Object} params - Search parameters
   * @param {string} params.query - Search query
   * @param {number} params.maxResults - Max results (default 25, max 50)
   * @param {string} params.type - Content type (default 'video')
   * @param {string} params.videoDuration - 'short', 'medium', 'long' (long = 20+ min)
   * @param {string} params.videoCaption - 'closedCaption' to require captions
   */
  async search(params = {}) {
    if (!this.apiKey) {
      console.error('YouTube API key not configured');
      return [];
    }

    const {
      query,
      maxResults = 25,
      type = 'video',
      videoDuration = 'long', // Movies are usually 20+ minutes
      videoCaption = 'closedCaption', // Require captions
      relevanceLanguage = 'sq', // Prefer Albanian content
      order = 'relevance'
    } = params;

    try {
      const response = await axios.get(`${API_BASE}/search`, {
        params: {
          part: 'snippet',
          q: query,
          type,
          maxResults,
          videoDuration,
          videoCaption,
          relevanceLanguage,
          order,
          key: this.apiKey
        }
      });

      return response.data.items || [];
    } catch (error) {
      console.error('YouTube search failed:', error.response?.data?.error?.message || error.message);
      return [];
    }
  }

  /**
   * Get video details including content details
   * @param {string|string[]} videoIds - Video ID(s)
   */
  async getVideoDetails(videoIds) {
    if (!this.apiKey) return [];

    const ids = Array.isArray(videoIds) ? videoIds.join(',') : videoIds;

    try {
      const response = await axios.get(`${API_BASE}/videos`, {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: ids,
          key: this.apiKey
        }
      });

      return response.data.items || [];
    } catch (error) {
      console.error('YouTube video details failed:', error.response?.data?.error?.message || error.message);
      return [];
    }
  }

  /**
   * Get available captions for a video
   * @param {string} videoId - YouTube video ID
   */
  async getCaptions(videoId) {
    if (!this.apiKey) return [];

    try {
      const response = await axios.get(`${API_BASE}/captions`, {
        params: {
          part: 'snippet',
          videoId,
          key: this.apiKey
        }
      });

      return response.data.items || [];
    } catch (error) {
      // Caption list often returns 403 for videos without public captions
      // This is expected behavior
      if (error.response?.status !== 403) {
        console.error('YouTube captions failed:', error.response?.data?.error?.message || error.message);
      }
      return [];
    }
  }

  /**
   * Check if video has Albanian captions
   * @param {string} videoId - YouTube video ID
   */
  async hasAlbanianCaptions(videoId) {
    const captions = await this.getCaptions(videoId);

    // Check for Albanian language codes
    const albanianCodes = ['sq', 'alb', 'sqi'];

    return captions.some(caption => {
      const lang = caption.snippet?.language?.toLowerCase() || '';
      return albanianCodes.some(code => lang.includes(code));
    });
  }

  /**
   * Search for Albanian movies/content with captions
   * @param {Object} params - Search parameters
   */
  async searchAlbanianContent(params = {}) {
    const { limit = 20 } = params;

    console.log('Searching for Albanian content with captions...');

    // Search queries that might find Albanian content
    const queries = [
      'film shqip',
      'filma shqip full',
      'albanian movie',
      'albanian film',
      'kosovo film',
      'shqip film i plote'
    ];

    const allResults = [];
    const seenIds = new Set();

    for (const query of queries) {
      if (allResults.length >= limit) break;

      const results = await this.search({
        query,
        maxResults: 10,
        videoDuration: 'long',
        videoCaption: 'closedCaption'
      });

      for (const item of results) {
        const videoId = item.id?.videoId;
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          allResults.push(item);
        }
      }

      // Rate limiting
      await this.delay(200);
    }

    console.log(`Found ${allResults.length} potential videos`);
    return allResults.slice(0, limit);
  }

  /**
   * Search for movies with Albanian subtitles specifically
   * Uses search terms that indicate Albanian subtitles
   */
  async searchMoviesWithAlbanianSubs(params = {}) {
    const { query = '', limit = 20 } = params;

    console.log('Searching for movies with Albanian subtitles...');

    // Search terms that indicate Albanian subtitles
    const searchTerms = query ? [
      `${query} albanian subtitles`,
      `${query} me titra shqip`,
      `${query} shqip sub`,
      `${query} titra shqip`
    ] : [
      'full movie albanian subtitles',
      'film me titra shqip',
      'movie me titra shqip',
      'full movie shqip sub',
      'film i plote titra shqip'
    ];

    const allResults = [];
    const seenIds = new Set();

    for (const term of searchTerms) {
      if (allResults.length >= limit) break;

      const results = await this.search({
        query: term,
        maxResults: 15,
        videoDuration: 'long',
        videoCaption: 'closedCaption'
      });

      for (const item of results) {
        const videoId = item.id?.videoId;
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          allResults.push(item);
        }
      }

      await this.delay(200);
    }

    // Get full details for found videos
    if (allResults.length > 0) {
      const videoIds = allResults.map(r => r.id.videoId);
      const details = await this.getVideoDetails(videoIds);

      // Merge details with search results
      const detailsMap = new Map(details.map(d => [d.id, d]));

      return allResults.map(result => {
        const detail = detailsMap.get(result.id.videoId);
        return {
          videoId: result.id.videoId,
          title: result.snippet.title,
          description: result.snippet.description,
          thumbnail: result.snippet.thumbnails?.high?.url || result.snippet.thumbnails?.default?.url,
          channelTitle: result.snippet.channelTitle,
          publishedAt: result.snippet.publishedAt,
          duration: detail?.contentDetails?.duration,
          viewCount: parseInt(detail?.statistics?.viewCount || 0),
          hasCaption: detail?.contentDetails?.caption === 'true'
        };
      }).slice(0, limit);
    }

    return [];
  }

  /**
   * Parse YouTube duration (ISO 8601) to seconds
   * @param {string} duration - e.g., 'PT1H30M45S'
   */
  parseDuration(duration) {
    if (!duration) return null;

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return null;

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Format video for database import
   * @param {Object} video - Video data from search
   */
  formatForImport(video) {
    return {
      sourceType: 'youtube',
      sourceId: video.videoId,
      title: video.title,
      description: video.description?.substring(0, 5000),
      thumbnail: video.thumbnail,
      videoUrl: `https://www.youtube.com/embed/${video.videoId}`, // Use embed URL directly
      duration: this.parseDuration(video.duration),
      views: video.viewCount || 0,
      hasSubtitles: true, // We only search for videos with captions
      subtitleLanguage: 'sq',
      subtitleUrl: null, // YouTube handles subtitles internally
      subtitleSynced: true // Already synced by YouTube
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new YouTubeService();
