/**
 * OpenSubtitles REST API Service
 * Handles searching and downloading subtitles from OpenSubtitles.com
 *
 * API Docs: https://opensubtitles.stoplight.io/docs/opensubtitles-api
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const API_BASE = 'https://api.opensubtitles.com/api/v1';
const USER_AGENT = 'IPTV-Platform v1.0';

class SubtitleService {
  constructor() {
    this.apiKey = process.env.OPENSUBTITLES_API_KEY;
    this.username = process.env.OPENSUBTITLES_USER;
    this.password = process.env.OPENSUBTITLES_PASS;
    this.token = null;
    this.tokenExpiry = null;
    this.subtitleDir = path.join(__dirname, '../../data/subtitles');
  }

  /**
   * Get headers for API requests
   */
  getHeaders(withAuth = false) {
    const headers = {
      'Content-Type': 'application/json',
      'Api-Key': this.apiKey,
      'User-Agent': USER_AGENT
    };

    if (withAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Login to OpenSubtitles API
   */
  async login() {
    // Check if we have a valid token
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return true;
    }

    if (!this.apiKey) {
      console.warn('OpenSubtitles API key not configured');
      return false;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/login`,
        {
          username: this.username,
          password: this.password
        },
        {
          headers: this.getHeaders(),
          timeout: 30000
        }
      );

      this.token = response.data.token;
      // Token valid for 24 hours, refresh after 23
      this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

      console.log('OpenSubtitles login successful');
      return true;
    } catch (error) {
      console.error('OpenSubtitles login failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Search for Albanian subtitles
   * @param {Object} params - Search parameters
   * @param {string} params.query - Movie title
   * @param {string} params.imdbId - IMDB ID (more accurate)
   * @param {number} params.year - Release year
   */
  async searchAlbanian(params) {
    const { query, imdbId, year } = params;

    if (!this.apiKey) {
      console.warn('OpenSubtitles API key not configured, skipping subtitle search');
      return [];
    }

    try {
      const searchParams = new URLSearchParams();
      searchParams.append('languages', 'sq,al'); // Albanian language codes

      if (imdbId) {
        // Remove 'tt' prefix if present for API
        const cleanImdbId = imdbId.replace(/^tt/, '');
        searchParams.append('imdb_id', cleanImdbId);
      } else if (query) {
        searchParams.append('query', query);
      }

      if (year) {
        searchParams.append('year', year.toString());
      }

      searchParams.append('order_by', 'download_count');
      searchParams.append('order_direction', 'desc');

      const response = await axios.get(
        `${API_BASE}/subtitles?${searchParams.toString()}`,
        {
          headers: this.getHeaders(),
          maxRedirects: 5,
          timeout: 30000
        }
      );

      const results = response.data.data || [];

      console.log(`Found ${results.length} Albanian subtitles for "${query || imdbId}"`);

      return results.map(sub => ({
        id: sub.id,
        fileId: sub.attributes.files?.[0]?.file_id,
        fileName: sub.attributes.files?.[0]?.file_name,
        language: sub.attributes.language,
        downloadCount: sub.attributes.download_count,
        rating: sub.attributes.ratings,
        release: sub.attributes.release,
        fps: sub.attributes.fps,
        format: sub.attributes.format
      }));
    } catch (error) {
      console.error('Subtitle search failed:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Download subtitle file using curl (more reliable than axios for OpenSubtitles)
   * @param {number} fileId - Subtitle file ID from search results
   * @param {string} outputName - Output filename (without extension)
   */
  async download(fileId, outputName) {
    if (!fileId) {
      console.error('No file ID provided for download');
      return null;
    }

    // Ensure we're logged in
    const loggedIn = await this.login();
    if (!loggedIn) {
      console.error('Must be logged in to download subtitles');
      return null;
    }

    try {
      // Ensure subtitle directory exists
      await fs.mkdir(this.subtitleDir, { recursive: true });

      const outputPath = path.join(this.subtitleDir, `${outputName}.srt`);

      // Use curl for the entire download process (more reliable with OpenSubtitles)
      // First get the download link
      const downloadLinkCmd = `curl -s -X POST "${API_BASE}/download" \
        -H "Content-Type: application/json" \
        -H "Api-Key: ${this.apiKey}" \
        -H "User-Agent: ${USER_AGENT}" \
        -H "Authorization: Bearer ${this.token}" \
        -d '{"file_id":${fileId}}'`;

      const { stdout: linkResponse } = await execAsync(downloadLinkCmd, { timeout: 30000 });
      const linkData = JSON.parse(linkResponse);

      if (!linkData.link) {
        console.error('No download link in response:', linkResponse.substring(0, 200));
        return null;
      }

      const downloadUrl = linkData.link;
      const fileName = linkData.file_name || `${outputName}.srt`;

      // Download the actual subtitle file
      const downloadCmd = `curl -s -H "User-Agent: ${USER_AGENT}" "${downloadUrl}" -o "${outputPath}"`;
      await execAsync(downloadCmd, { timeout: 60000 });

      // Verify file was downloaded
      const stat = await fs.stat(outputPath);
      if (stat.size < 100) {
        // File too small, likely an error page
        const content = await fs.readFile(outputPath, 'utf-8');
        if (content.includes('Error') || content.includes('503')) {
          console.error('Download failed - got error page');
          await fs.unlink(outputPath);
          return null;
        }
      }

      console.log(`Subtitle downloaded: ${outputPath}`);

      return {
        path: outputPath,
        fileName,
        remaining: linkData.remaining
      };
    } catch (error) {
      console.error('Subtitle download failed:', error.message);
      return null;
    }
  }

  /**
   * Search and download best Albanian subtitle for a movie
   * @param {Object} movie - Movie info
   * @param {string} movie.title - Movie title
   * @param {string} movie.imdbId - IMDB ID
   * @param {number} movie.year - Release year
   * @param {string} movie.id - Video ID for output naming
   */
  async getSubtitleForMovie(movie) {
    const { title, imdbId, year, id } = movie;

    // Search for subtitles
    const results = await this.searchAlbanian({ query: title, imdbId, year });

    if (results.length === 0) {
      console.log(`No Albanian subtitles found for: ${title}`);
      return null;
    }

    // Get the best result (first one, sorted by download count)
    const best = results[0];

    if (!best.fileId) {
      console.log(`No downloadable file for: ${title}`);
      return null;
    }

    // Download it
    const downloaded = await this.download(best.fileId, id || title.replace(/[^a-z0-9]/gi, '_'));

    if (!downloaded) {
      return null;
    }

    return {
      ...downloaded,
      subtitleInfo: best
    };
  }

  /**
   * Get subtitle URL for serving
   * @param {string} videoId - Video ID
   */
  getSubtitleUrl(videoId) {
    return `/api/videos/${videoId}/subtitle`;
  }

  /**
   * Read subtitle file content
   * @param {string} videoId - Video ID
   */
  async readSubtitle(videoId) {
    const filePath = path.join(this.subtitleDir, `${videoId}.srt`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Subtitle file not found: ${filePath}`);
      return null;
    }
  }
}

module.exports = new SubtitleService();
