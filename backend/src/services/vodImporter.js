/**
 * VOD Importer Service
 * Imports movies from Internet Archive with Albanian subtitles
 * Uses ffsubsync for automatic subtitle synchronization
 */

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const archiveService = require('./archiveService');
const subtitleService = require('./subtitleService');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

class VodImporter {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.subtitleDir = path.join(this.dataDir, 'subtitles');
    this.tempDir = path.join(this.dataDir, 'temp');
    this.stats = {
      processed: 0,
      imported: 0,
      withSubtitles: 0,
      synced: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Initialize directories
   */
  async init() {
    await fs.mkdir(this.subtitleDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Import popular public domain movies with subtitles
   */
  async importPopularMovies(options = {}) {
    const { limit = 20, skipExisting = true, syncSubtitles = true } = options;

    await this.init();
    this.resetStats();

    console.log('='.repeat(60));
    console.log('VOD Import: Popular Public Domain Movies');
    console.log('='.repeat(60));

    // Get popular movies from Internet Archive
    const movies = await archiveService.getPopularPublicDomainMovies();
    const toProcess = movies.slice(0, limit);

    console.log(`Found ${toProcess.length} movies to process\n`);

    for (const movie of toProcess) {
      await this.importMovie(movie, { skipExisting, syncSubtitles });
    }

    this.printStats();
    return this.stats;
  }

  /**
   * Import movies by search query
   */
  async importBySearch(query, options = {}) {
    const { limit = 20, skipExisting = true, syncSubtitles = true } = options;

    await this.init();
    this.resetStats();

    console.log('='.repeat(60));
    console.log(`VOD Import: Search "${query}"`);
    console.log('='.repeat(60));

    // Search Internet Archive
    const results = await archiveService.searchMovies({ query, rows: limit });

    console.log(`Found ${results.length} results\n`);

    for (const result of results) {
      // Get full metadata
      const movie = await archiveService.getMetadata(result.sourceId);
      if (movie) {
        await this.importMovie(movie, { skipExisting, syncSubtitles });
      }
      // Rate limiting
      await this.delay(1000);
    }

    this.printStats();
    return this.stats;
  }

  /**
   * Import Albanian-related movies
   */
  async importAlbanianContent(options = {}) {
    const { limit = 50, skipExisting = true, syncSubtitles = true } = options;

    await this.init();
    this.resetStats();

    console.log('='.repeat(60));
    console.log('VOD Import: Albanian Content');
    console.log('='.repeat(60));

    const movies = await archiveService.searchAlbanianMovies(limit);

    console.log(`Found ${movies.length} Albanian-related movies\n`);

    for (const result of movies) {
      const movie = await archiveService.getMetadata(result.sourceId);
      if (movie) {
        await this.importMovie(movie, { skipExisting, syncSubtitles });
      }
      await this.delay(1000);
    }

    this.printStats();
    return this.stats;
  }

  /**
   * Import a single movie
   */
  async importMovie(movie, options = {}) {
    const { skipExisting = true, syncSubtitles = true } = options;

    this.stats.processed++;
    console.log(`\n[${this.stats.processed}] Processing: ${movie.title}`);

    try {
      // Check if already exists
      if (skipExisting) {
        const existing = await prisma.video.findFirst({
          where: {
            sourceType: 'archive',
            sourceId: movie.sourceId
          }
        });

        if (existing) {
          console.log(`  ⏭️  Already exists, skipping`);
          this.stats.skipped++;
          return existing;
        }
      }

      // Search for Albanian subtitles
      let subtitleData = null;
      let subtitleSynced = false;

      const subtitleResult = await subtitleService.getSubtitleForMovie({
        title: movie.title,
        year: movie.year,
        id: movie.sourceId
      });

      if (subtitleResult) {
        console.log(`  ✅ Found Albanian subtitle`);
        subtitleData = subtitleResult;
        this.stats.withSubtitles++;

        // Attempt to sync subtitle with video
        if (syncSubtitles) {
          const synced = await this.syncSubtitle(
            movie.videoUrl,
            subtitleResult.path,
            movie.sourceId
          );
          subtitleSynced = synced;
          if (synced) {
            this.stats.synced++;
          }
        }
      } else {
        console.log(`  ⚠️  No Albanian subtitle found`);
      }

      // Create video record
      const video = await prisma.video.create({
        data: {
          title: movie.title,
          description: movie.description?.substring(0, 5000),
          thumbnail: movie.thumbnail,
          videoUrl: movie.videoUrl,
          duration: movie.duration,
          category: this.categorizeMovie(movie),
          tags: movie.tags || [],
          isActive: true,
          sourceType: 'archive',
          sourceId: movie.sourceId,
          year: movie.year,
          language: movie.language,
          hasSubtitles: !!subtitleData,
          subtitleUrl: subtitleData ? `/api/videos/${movie.sourceId}/subtitle` : null,
          subtitleLanguage: subtitleData ? 'sq' : null,
          subtitleSynced
        }
      });

      console.log(`  ✅ Imported: ${video.id}`);
      this.stats.imported++;

      return video;
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
      this.stats.failed++;
      return null;
    }
  }

  /**
   * Sync subtitle timing using ffsubsync
   * Downloads a portion of video audio to sync against
   */
  async syncSubtitle(videoUrl, subtitlePath, videoId) {
    console.log(`  🔄 Syncing subtitle...`);

    const outputPath = path.join(this.subtitleDir, `${videoId}_synced.srt`);
    const tempAudioPath = path.join(this.tempDir, `${videoId}_audio.wav`);

    try {
      // Download first 10 minutes of audio for sync reference
      // This is much faster than downloading the whole video
      console.log(`    Extracting audio sample...`);

      await execAsync(
        `ffmpeg -y -i "${videoUrl}" -t 600 -vn -acodec pcm_s16le -ar 16000 -ac 1 "${tempAudioPath}" 2>/dev/null`,
        { timeout: 120000 }
      );

      // Check if audio was extracted
      const audioExists = await fs.access(tempAudioPath).then(() => true).catch(() => false);
      if (!audioExists) {
        console.log(`    ⚠️  Could not extract audio, keeping original subtitle`);
        return false;
      }

      // Run ffsubsync
      console.log(`    Running ffsubsync...`);
      await execAsync(
        `ffsubsync "${tempAudioPath}" -i "${subtitlePath}" -o "${outputPath}"`,
        { timeout: 300000 }
      );

      // Check if synced file was created
      const syncedExists = await fs.access(outputPath).then(() => true).catch(() => false);
      if (syncedExists) {
        // Replace original with synced version
        await fs.rename(outputPath, subtitlePath);
        console.log(`    ✅ Subtitle synced successfully`);
        return true;
      }

      return false;
    } catch (error) {
      console.log(`    ⚠️  Sync failed: ${error.message}`);
      return false;
    } finally {
      // Cleanup temp audio file
      await fs.unlink(tempAudioPath).catch(() => {});
    }
  }

  /**
   * Categorize movie based on metadata
   */
  categorizeMovie(movie) {
    const title = (movie.title || '').toLowerCase();
    const description = (movie.description || '').toLowerCase();
    const tags = (movie.tags || []).map(t => t.toLowerCase());
    const combined = `${title} ${description} ${tags.join(' ')}`;

    if (combined.match(/horror|zombie|vampire|monster|scary|haunted/)) {
      return 'Horror';
    }
    if (combined.match(/comedy|funny|humor|laugh/)) {
      return 'Comedy';
    }
    if (combined.match(/action|adventure|fight|war|battle/)) {
      return 'Action';
    }
    if (combined.match(/romance|love|romantic/)) {
      return 'Romance';
    }
    if (combined.match(/sci-fi|science fiction|space|alien|future/)) {
      return 'Sci-Fi';
    }
    if (combined.match(/documentary|document|history|historical/)) {
      return 'Documentary';
    }
    if (combined.match(/drama/)) {
      return 'Drama';
    }
    if (combined.match(/thriller|suspense|mystery/)) {
      return 'Thriller';
    }
    if (combined.match(/western|cowboy/)) {
      return 'Western';
    }
    if (combined.match(/noir|crime|detective/)) {
      return 'Film Noir';
    }

    return 'Classic';
  }

  /**
   * Import a specific movie by archive.org identifier
   */
  async importById(identifier, options = {}) {
    await this.init();
    this.resetStats();

    console.log(`Importing: ${identifier}`);

    const movie = await archiveService.getMetadata(identifier);
    if (!movie) {
      console.log('Movie not found on Internet Archive');
      return null;
    }

    return this.importMovie(movie, options);
  }

  /**
   * Reset import statistics
   */
  resetStats() {
    this.stats = {
      processed: 0,
      imported: 0,
      withSubtitles: 0,
      synced: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Print import statistics
   */
  printStats() {
    console.log('\n' + '='.repeat(60));
    console.log('Import Complete');
    console.log('='.repeat(60));
    console.log(`  Processed:      ${this.stats.processed}`);
    console.log(`  Imported:       ${this.stats.imported}`);
    console.log(`  With Subtitles: ${this.stats.withSubtitles}`);
    console.log(`  Synced:         ${this.stats.synced}`);
    console.log(`  Skipped:        ${this.stats.skipped}`);
    console.log(`  Failed:         ${this.stats.failed}`);
    console.log('='.repeat(60));
  }

  /**
   * Get current video stats from database
   */
  async getStats() {
    const [total, withSubtitles, synced, byCategory] = await Promise.all([
      prisma.video.count({ where: { sourceType: 'archive' } }),
      prisma.video.count({ where: { sourceType: 'archive', hasSubtitles: true } }),
      prisma.video.count({ where: { sourceType: 'archive', subtitleSynced: true } }),
      prisma.video.groupBy({
        by: ['category'],
        where: { sourceType: 'archive' },
        _count: true
      })
    ]);

    return {
      total,
      withSubtitles,
      synced,
      withoutSubtitles: total - withSubtitles,
      byCategory: byCategory.reduce((acc, c) => {
        acc[c.category || 'Uncategorized'] = c._count;
        return acc;
      }, {})
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new VodImporter();
