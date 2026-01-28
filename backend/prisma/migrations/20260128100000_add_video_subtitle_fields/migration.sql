-- AlterTable
ALTER TABLE "videos" ADD COLUMN "source_type" TEXT;
ALTER TABLE "videos" ADD COLUMN "source_id" TEXT;
ALTER TABLE "videos" ADD COLUMN "imdb_id" TEXT;
ALTER TABLE "videos" ADD COLUMN "year" INTEGER;
ALTER TABLE "videos" ADD COLUMN "has_subtitles" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "videos" ADD COLUMN "subtitle_url" TEXT;
ALTER TABLE "videos" ADD COLUMN "subtitle_language" TEXT DEFAULT 'sq';
ALTER TABLE "videos" ADD COLUMN "subtitle_synced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "videos" ADD COLUMN "language" TEXT;
ALTER TABLE "videos" ADD COLUMN "country" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "videos_source_type_source_id_key" ON "videos"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "videos_has_subtitles_idx" ON "videos"("has_subtitles");

-- CreateIndex
CREATE INDEX "videos_category_idx" ON "videos"("category");

-- CreateIndex
CREATE INDEX "videos_country_idx" ON "videos"("country");
