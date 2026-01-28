/**
 * Internet Archive Service
 * Fetches public domain movies from archive.org
 *
 * API Docs: https://archive.org/developers/
 */

const axios = require('axios');

const API_BASE = 'https://archive.org';
const METADATA_BASE = 'https://archive.org/metadata';
const DOWNLOAD_BASE = 'https://archive.org/download';

class ArchiveService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000
    });
  }

  /**
   * Search for movies on Internet Archive
   * @param {Object} params - Search parameters
   * @param {string} params.query - Search query
   * @param {string} params.collection - Collection to search (default: feature_films)
   * @param {number} params.rows - Number of results (default: 50)
   * @param {number} params.page - Page number (default: 1)
   */
  async searchMovies(params = {}) {
    const {
      query = '',
      collection = 'feature_films',
      rows = 50,
      page = 1,
      language = null
    } = params;

    try {
      // Build search query
      let searchQuery = `collection:${collection} AND mediatype:movies`;

      if (query) {
        searchQuery += ` AND (title:"${query}" OR description:"${query}")`;
      }

      if (language) {
        searchQuery += ` AND language:${language}`;
      }

      const response = await this.client.get('/advancedsearch.php', {
        params: {
          q: searchQuery,
          fl: 'identifier,title,description,year,creator,runtime,downloads,avg_rating,language',
          sort: 'downloads desc',
          output: 'json',
          rows,
          page
        }
      });

      const docs = response.data.response?.docs || [];

      console.log(`Found ${docs.length} movies from Internet Archive`);

      return docs.map(doc => ({
        sourceId: doc.identifier,
        title: doc.title,
        description: doc.description,
        year: doc.year ? parseInt(doc.year) : null,
        creator: doc.creator,
        runtime: doc.runtime,
        downloads: doc.downloads,
        rating: doc.avg_rating,
        language: doc.language
      }));
    } catch (error) {
      console.error('Archive search failed:', error.message);
      return [];
    }
  }

  /**
   * Get detailed metadata for an item
   * @param {string} identifier - Archive.org item identifier
   */
  async getMetadata(identifier) {
    try {
      const response = await axios.get(`${METADATA_BASE}/${identifier}`);
      const data = response.data;

      // Check if item is "dark" (removed from public access)
      if (data.is_dark) {
        console.log(`Item ${identifier} is dark/unavailable`);
        return null;
      }

      if (!data || !data.metadata) {
        return null;
      }

      const metadata = data.metadata;
      const files = data.files || [];

      // Find best video file (prefer mp4, then h264, then any video)
      const videoFile = this.findBestVideoFile(files);
      const thumbnailFile = files.find(f =>
        f.name?.endsWith('.jpg') ||
        f.name?.endsWith('.png') ||
        f.name?.includes('thumb')
      );

      if (!videoFile) {
        console.log(`No video file found for: ${identifier}`);
        return null;
      }

      return {
        sourceId: identifier,
        sourceType: 'archive',
        title: metadata.title || identifier,
        description: metadata.description,
        year: metadata.year ? parseInt(metadata.year) : null,
        creator: Array.isArray(metadata.creator)
          ? metadata.creator.join(', ')
          : metadata.creator,
        duration: this.parseDuration(videoFile.length || metadata.runtime),
        videoUrl: `${DOWNLOAD_BASE}/${identifier}/${videoFile.name}`,
        thumbnail: thumbnailFile
          ? `${DOWNLOAD_BASE}/${identifier}/${thumbnailFile.name}`
          : `https://archive.org/services/img/${identifier}`,
        language: metadata.language,
        tags: Array.isArray(metadata.subject)
          ? metadata.subject
          : metadata.subject ? [metadata.subject] : [],
        license: metadata.licenseurl || 'Public Domain',
        videoFormat: videoFile.format,
        fileSize: videoFile.size
      };
    } catch (error) {
      console.error(`Failed to get metadata for ${identifier}:`, error.message);
      return null;
    }
  }

  /**
   * Find the best video file from archive files list
   */
  findBestVideoFile(files) {
    // Priority order for video formats
    const priorities = [
      { ext: '.mp4', format: 'h.264' },
      { ext: '.mp4', format: 'MPEG4' },
      { ext: '.mp4', format: null },
      { ext: '.ogv', format: null },
      { ext: '.avi', format: null },
      { ext: '.mkv', format: null }
    ];

    for (const prio of priorities) {
      const match = files.find(f => {
        if (!f.name) return false;
        const hasExt = f.name.toLowerCase().endsWith(prio.ext);
        if (!hasExt) return false;
        if (prio.format && f.format) {
          return f.format.toLowerCase().includes(prio.format.toLowerCase());
        }
        return true;
      });

      if (match) return match;
    }

    // Fallback: any video file
    return files.find(f =>
      f.format?.toLowerCase().includes('video') ||
      f.name?.match(/\.(mp4|avi|mkv|ogv|webm|mov)$/i)
    );
  }

  /**
   * Parse duration string to seconds
   */
  parseDuration(duration) {
    if (!duration) return null;
    if (typeof duration === 'number') return Math.round(duration);

    // Format: "1:30:45" or "90:45" or "5400"
    const str = String(duration);

    if (/^\d+$/.test(str)) {
      return parseInt(str);
    }

    const parts = str.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }

    return null;
  }

  /**
   * Search for Albanian content specifically
   */
  async searchAlbanianMovies(limit = 50) {
    const results = [];

    // Search various Albanian-related terms
    const queries = [
      'Albanian',
      'Albania',
      'Kosovo',
      'Shqiptar',
      'Shqipëri'
    ];

    for (const query of queries) {
      const movies = await this.searchMovies({
        query,
        rows: Math.ceil(limit / queries.length)
      });
      results.push(...movies);
    }

    // Remove duplicates
    const unique = Array.from(
      new Map(results.map(m => [m.sourceId, m])).values()
    );

    return unique.slice(0, limit);
  }

  /**
   * Get curated list of popular public domain movies
   * These are well-known films with likely Albanian subtitle availability
   */
  async getPopularPublicDomainMovies() {
    // Verified available public domain movies (checked 2026)
    const popularIds = [
      'Nosferatu_most_complete_version_93_mins.',
      'HisGirlFriday',
      'Charade1963',
      'house_on_haunted_hill_colorized',
      'carnival_of_souls',
      'the_little_shop_of_horrors_colorized',
      'reefer_madness_colorized',
      'plan_9_from_outer_space_colorized',
      'dementia-13',
      'ThePhantomOfTheOpera1925',
      'DOA1949',
      'Detour1945',
      'ScarletStreet1945',
      'ToBeOrNotToBe1942',
      'TheGeneralBusterKeaton',
      'the-count-of-monte-cristo-1934',
      'Metropolis1927',
      'M_1931',
      'The39Steps1935',
      'TheLadyVanishes1938'
    ];

    const movies = [];

    for (const id of popularIds) {
      const metadata = await this.getMetadata(id);
      if (metadata) {
        movies.push(metadata);
      }
      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return movies;
  }

  /**
   * Search by IMDB ID if the archive item has it
   */
  async searchByImdb(imdbId) {
    try {
      const response = await this.client.get('/advancedsearch.php', {
        params: {
          q: `imdb:${imdbId} AND mediatype:movies`,
          fl: 'identifier',
          output: 'json',
          rows: 1
        }
      });

      const docs = response.data.response?.docs || [];

      if (docs.length > 0) {
        return this.getMetadata(docs[0].identifier);
      }

      return null;
    } catch (error) {
      console.error(`IMDB search failed for ${imdbId}:`, error.message);
      return null;
    }
  }
}

module.exports = new ArchiveService();
