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

const COLLECTIONS = {
  feature_films: {
    id: 'feature_films',
    name: 'Feature Films',
    description: 'Classic feature-length movies in the public domain',
    mediatype: 'movies',
    icon: '🎬',
    estimatedCount: 27000
  },
  classic_tv: {
    id: 'classic_tv',
    name: 'Classic TV Shows',
    description: 'Vintage television programs and series',
    mediatype: 'movies',
    icon: '📺',
    estimatedCount: 5000
  },
  opensource_movies: {
    id: 'opensource_movies',
    name: 'Open Source Movies',
    description: 'Community-contributed open source films',
    mediatype: 'movies',
    icon: '🎥',
    estimatedCount: 15000
  },
  prelinger: {
    id: 'prelinger',
    name: 'Prelinger Archives',
    description: 'Industrial, educational, and ephemeral films',
    mediatype: 'movies',
    icon: '🏭',
    estimatedCount: 8000
  },
  moviesandfilms: {
    id: 'moviesandfilms',
    name: 'Movies & Films',
    description: 'General movie collection',
    mediatype: 'movies',
    icon: '🎞️',
    estimatedCount: 12000
  },
  classic_cartoons: {
    id: 'classic_cartoons',
    name: 'Classic Cartoons',
    description: 'Vintage animated cartoons and shorts',
    mediatype: 'movies',
    icon: '🎨',
    estimatedCount: 3000
  },
  film_noir: {
    id: 'film_noir',
    name: 'Film Noir',
    description: 'Classic film noir and crime dramas',
    mediatype: 'movies',
    icon: '🕵️',
    estimatedCount: 500
  },
  silent_films: {
    id: 'silent_films',
    name: 'Silent Films',
    description: 'Classic silent era cinema',
    mediatype: 'movies',
    icon: '🎭',
    estimatedCount: 2000
  },
  scifi: {
    id: 'SciFi_Horror',
    name: 'Sci-Fi & Horror',
    description: 'Science fiction and horror classics',
    mediatype: 'movies',
    icon: '👽',
    estimatedCount: 1500
  },
  comedy_films: {
    id: 'comedy_films',
    name: 'Comedy Films',
    description: 'Classic comedy movies',
    mediatype: 'movies',
    icon: '😂',
    estimatedCount: 2500
  }
};

class ArchiveService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 60000
    });
    this.collections = COLLECTIONS;
    this.statsCache = null;
    this.statsCacheTime = null;
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    this.lastRequestTime = 0;
    this.MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests
  }

  /**
   * Rate-limited request wrapper with retry logic
   */
  async rateLimitedRequest(url, params, retries = 5) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.client.get(url, { params });
        return response;
      } catch (error) {
        const isRateLimited = error.response?.status === 429;
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

        if ((isRateLimited || isTimeout) && attempt < retries - 1) {
          const backoffTime = Math.pow(2, attempt + 1) * 3000; // 6s, 12s, 24s, 48s
          console.log(`Archive.org ${isRateLimited ? 'rate limited' : 'timeout'}, waiting ${backoffTime / 1000}s before retry ${attempt + 2}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Get available collections with estimated counts
   */
  getCollections() {
    return Object.entries(COLLECTIONS).map(([key, col]) => ({
      ...col,
      key,
      count: col.estimatedCount
    }));
  }

  /**
   * Get collection info by ID
   */
  getCollection(collectionId) {
    return COLLECTIONS[collectionId] || null;
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

  /**
   * Browse a specific collection with pagination
   * @param {string} collectionId - Collection ID
   * @param {Object} options - Browse options
   */
  async browseCollection(collectionId, options = {}) {
    const { page = 1, rows = 50, sort = 'downloads desc' } = options;
    const collection = COLLECTIONS[collectionId];

    if (!collection) {
      console.error(`Unknown collection: ${collectionId}`);
      return { items: [], total: 0, page: 1, pages: 0 };
    }

    try {
      const response = await this.rateLimitedRequest('/advancedsearch.php', {
        q: `collection:${collection.id} AND mediatype:${collection.mediatype}`,
        fl: 'identifier,title,description,year,creator,runtime,downloads,avg_rating,language',
        sort,
        output: 'json',
        rows,
        page
      });

      const docs = response.data.response?.docs || [];
      const total = response.data.response?.numFound || 0;

      return {
        items: docs.map(doc => ({
          sourceId: doc.identifier,
          title: doc.title,
          description: doc.description,
          year: doc.year ? parseInt(doc.year) : null,
          creator: doc.creator,
          runtime: doc.runtime,
          downloads: doc.downloads,
          rating: doc.avg_rating,
          language: doc.language,
          collection: collectionId
        })),
        total,
        page,
        pages: Math.ceil(total / rows)
      };
    } catch (error) {
      console.error(`Browse collection failed for ${collectionId}:`, error.message);
      return { items: [], total: 0, page: 1, pages: 0 };
    }
  }

  /**
   * Search across multiple collections
   * @param {Object} params - Search parameters
   */
  async searchAllCollections(params = {}) {
    const { query = '', rows = 50, page = 1, collections = null } = params;

    const targetCollections = collections || Object.keys(COLLECTIONS);
    const collectionQuery = targetCollections
      .map(c => COLLECTIONS[c]?.id || c)
      .map(id => `collection:${id}`)
      .join(' OR ');

    try {
      let searchQuery = `(${collectionQuery}) AND mediatype:movies`;
      if (query) {
        searchQuery += ` AND (title:"${query}" OR description:"${query}" OR creator:"${query}")`;
      }

      const response = await this.rateLimitedRequest('/advancedsearch.php', {
        q: searchQuery,
        fl: 'identifier,title,description,year,creator,runtime,downloads,avg_rating,language,collection',
        sort: 'downloads desc',
        output: 'json',
        rows,
        page
      });

      const docs = response.data.response?.docs || [];
      const total = response.data.response?.numFound || 0;

      return {
        items: docs.map(doc => ({
          sourceId: doc.identifier,
          title: doc.title,
          description: doc.description,
          year: doc.year ? parseInt(doc.year) : null,
          creator: doc.creator,
          runtime: doc.runtime,
          downloads: doc.downloads,
          rating: doc.avg_rating,
          language: doc.language,
          collection: Array.isArray(doc.collection) ? doc.collection[0] : doc.collection
        })),
        total,
        page,
        pages: Math.ceil(total / rows)
      };
    } catch (error) {
      console.error('Search all collections failed:', error.message);
      return { items: [], total: 0, page: 1, pages: 0 };
    }
  }

  /**
   * Get collection statistics with caching
   */
  async getCollectionStats(forceRefresh = false) {
    // Return cached stats if still valid
    if (!forceRefresh && this.statsCache && this.statsCacheTime) {
      const age = Date.now() - this.statsCacheTime;
      if (age < this.CACHE_TTL) {
        console.log('Returning cached collection stats');
        return this.statsCache;
      }
    }

    const stats = [];
    const collectionEntries = Object.entries(COLLECTIONS);

    // Fetch stats with proper rate limiting
    for (let i = 0; i < collectionEntries.length; i++) {
      const [key, collection] = collectionEntries[i];

      try {
        const response = await this.rateLimitedRequest('/advancedsearch.php', {
          q: `collection:${collection.id} AND mediatype:${collection.mediatype}`,
          fl: 'identifier',
          output: 'json',
          rows: 0
        });

        stats.push({
          ...collection,
          key,
          count: response.data.response?.numFound || 0
        });

        console.log(`Collection ${key}: ${response.data.response?.numFound || 0} items`);
      } catch (error) {
        console.error(`Stats fetch failed for ${key}:`, error.message);
        stats.push({
          ...collection,
          key,
          count: 0,
          error: error.message
        });
      }
    }

    // Cache the results
    this.statsCache = stats;
    this.statsCacheTime = Date.now();

    return stats;
  }

  /**
   * Import from multiple collections at once
   * @param {Object} options - Import options
   */
  async getItemsFromCollections(options = {}) {
    const {
      collections = ['feature_films'],
      limitPerCollection = 20,
      sort = 'downloads desc'
    } = options;

    const allItems = [];

    for (const collectionId of collections) {
      const result = await this.browseCollection(collectionId, {
        rows: limitPerCollection,
        sort
      });
      allItems.push(...result.items);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return allItems;
  }
}

module.exports = new ArchiveService();
