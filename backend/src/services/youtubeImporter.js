/**
 * YouTube VOD Importer
 * Imports YouTube videos with Albanian captions to the database
 */

const { PrismaClient } = require('@prisma/client');
const youtubeService = require('./youtubeService');

const prisma = new PrismaClient();

class YouTubeImporter {
  constructor() {
    this.stats = {
      processed: 0,
      imported: 0,
      skipped: 0,
      failed: 0
    };
  }

  /**
   * Import Albanian content from YouTube
   */
  async importAlbanianContent(options = {}) {
    const { limit = 20, skipExisting = true } = options;

    this.resetStats();

    console.log('='.repeat(60));
    console.log('YouTube Import: Albanian Content with Captions');
    console.log('='.repeat(60));

    if (!youtubeService.isConfigured()) {
      console.error('\n❌ YouTube API key not configured!');
      console.log('Add YOUTUBE_API_KEY to your .env file');
      console.log('Get one at: https://console.cloud.google.com/apis/credentials\n');
      return this.stats;
    }

    const videos = await youtubeService.searchAlbanianContent({ limit });

    console.log(`\nFound ${videos.length} videos to process\n`);

    for (const video of videos) {
      await this.importVideo(video, { skipExisting });
    }

    this.printStats();
    return this.stats;
  }

  /**
   * Import movies with Albanian subtitles
   */
  async importMoviesWithAlbanianSubs(options = {}) {
    const { query = '', limit = 20, skipExisting = true } = options;

    this.resetStats();

    console.log('='.repeat(60));
    console.log('YouTube Import: Movies with Albanian Subtitles');
    if (query) console.log(`Search query: "${query}"`);
    console.log('='.repeat(60));

    if (!youtubeService.isConfigured()) {
      console.error('\n❌ YouTube API key not configured!');
      console.log('Add YOUTUBE_API_KEY to your .env file');
      console.log('Get one at: https://console.cloud.google.com/apis/credentials\n');
      return this.stats;
    }

    const videos = await youtubeService.searchMoviesWithAlbanianSubs({ query, limit });

    console.log(`\nFound ${videos.length} videos to process\n`);

    for (const video of videos) {
      await this.importVideo(video, { skipExisting });
    }

    this.printStats();
    return this.stats;
  }

  /**
   * Search and import by custom query
   */
  async importBySearch(query, options = {}) {
    const { limit = 20, skipExisting = true } = options;

    this.resetStats();

    console.log('='.repeat(60));
    console.log(`YouTube Import: Search "${query}"`);
    console.log('='.repeat(60));

    if (!youtubeService.isConfigured()) {
      console.error('\n❌ YouTube API key not configured!');
      return this.stats;
    }

    // Search with caption requirement
    const searchResults = await youtubeService.search({
      query: `${query} albanian subtitles OR titra shqip`,
      maxResults: limit,
      videoDuration: 'long',
      videoCaption: 'closedCaption'
    });

    if (searchResults.length === 0) {
      console.log('\nNo videos found with captions');
      return this.stats;
    }

    // Get full details
    const videoIds = searchResults.map(r => r.id.videoId);
    const details = await youtubeService.getVideoDetails(videoIds);
    const detailsMap = new Map(details.map(d => [d.id, d]));

    const videos = searchResults.map(result => {
      const detail = detailsMap.get(result.id.videoId);
      return {
        videoId: result.id.videoId,
        title: result.snippet.title,
        description: result.snippet.description,
        thumbnail: result.snippet.thumbnails?.high?.url,
        duration: detail?.contentDetails?.duration,
        viewCount: parseInt(detail?.statistics?.viewCount || 0),
        hasCaption: detail?.contentDetails?.caption === 'true'
      };
    });

    console.log(`\nFound ${videos.length} videos to process\n`);

    for (const video of videos) {
      await this.importVideo(video, { skipExisting });
    }

    this.printStats();
    return this.stats;
  }

  /**
   * Import a single video
   */
  async importVideo(video, options = {}) {
    const { skipExisting = true } = options;

    this.stats.processed++;
    console.log(`[${this.stats.processed}] ${video.title?.substring(0, 60)}...`);

    try {
      // Check if already exists
      if (skipExisting) {
        const existing = await prisma.video.findFirst({
          where: {
            sourceType: 'youtube',
            sourceId: video.videoId
          }
        });

        if (existing) {
          console.log(`  ⏭️  Already exists, skipping`);
          this.stats.skipped++;
          return existing;
        }
      }

      // Format for import
      const data = youtubeService.formatForImport(video);

      // Categorize based on title/description
      data.category = this.categorize(video);

      // Create video record
      const created = await prisma.video.create({
        data: {
          ...data,
          isActive: true,
          tags: this.extractTags(video)
        }
      });

      console.log(`  ✅ Imported (${data.category})`);
      this.stats.imported++;

      return created;
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
      this.stats.failed++;
      return null;
    }
  }

  /**
   * Import a specific YouTube video by ID
   */
  async importById(videoId, options = {}) {
    this.resetStats();

    console.log(`Importing YouTube video: ${videoId}`);

    if (!youtubeService.isConfigured()) {
      console.error('YouTube API key not configured!');
      return null;
    }

    const details = await youtubeService.getVideoDetails(videoId);

    if (details.length === 0) {
      console.log('Video not found');
      return null;
    }

    const video = details[0];
    const videoData = {
      videoId: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnail: video.snippet.thumbnails?.high?.url,
      duration: video.contentDetails?.duration,
      viewCount: parseInt(video.statistics?.viewCount || 0),
      hasCaption: video.contentDetails?.caption === 'true'
    };

    return this.importVideo(videoData, options);
  }

  /**
   * Categorize video based on content
   */
  categorize(video) {
    const text = `${video.title} ${video.description || ''}`.toLowerCase();

    if (text.match(/horror|scary|zombie|vampire|haunted/)) return 'Horror';
    if (text.match(/comedy|funny|komedi/)) return 'Comedy';
    if (text.match(/action|aksion|luftë|war/)) return 'Action';
    if (text.match(/drama|dramë/)) return 'Drama';
    if (text.match(/romance|dashuri|love|romantic/)) return 'Romance';
    if (text.match(/documentary|dokumentar/)) return 'Documentary';
    if (text.match(/thriller|suspense|mystery/)) return 'Thriller';
    if (text.match(/sci-fi|science fiction|fantashkencë/)) return 'Sci-Fi';
    if (text.match(/animation|animacion|cartoon/)) return 'Animation';
    if (text.match(/kids|fëmijë|children/)) return 'Kids';

    return 'Movie';
  }

  /**
   * Extract tags from video
   */
  extractTags(video) {
    const tags = ['youtube', 'albanian-subtitles'];

    const text = `${video.title} ${video.description || ''}`.toLowerCase();

    if (text.includes('shqip')) tags.push('shqip');
    if (text.includes('kosovo')) tags.push('kosovo');
    if (text.includes('full movie') || text.includes('film i plote')) tags.push('full-movie');

    return tags;
  }

  /**
   * Get YouTube video stats from database
   */
  async getStats() {
    const [total, byCategory] = await Promise.all([
      prisma.video.count({ where: { sourceType: 'youtube' } }),
      prisma.video.groupBy({
        by: ['category'],
        where: { sourceType: 'youtube' },
        _count: true
      })
    ]);

    return {
      total,
      byCategory: byCategory.reduce((acc, c) => {
        acc[c.category || 'Uncategorized'] = c._count;
        return acc;
      }, {})
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      processed: 0,
      imported: 0,
      skipped: 0,
      failed: 0
    };
  }

  /**
   * Print stats
   */
  printStats() {
    console.log('\n' + '='.repeat(60));
    console.log('Import Complete');
    console.log('='.repeat(60));
    console.log(`  Processed: ${this.stats.processed}`);
    console.log(`  Imported:  ${this.stats.imported}`);
    console.log(`  Skipped:   ${this.stats.skipped}`);
    console.log(`  Failed:    ${this.stats.failed}`);
    console.log('='.repeat(60));
  }
}

module.exports = new YouTubeImporter();
