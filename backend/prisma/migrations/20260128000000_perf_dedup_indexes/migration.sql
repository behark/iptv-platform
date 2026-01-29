-- Step 1: Remove duplicate channels, keeping the row with the most metadata per stream_url
DELETE FROM channels
WHERE id NOT IN (
  SELECT DISTINCT ON (stream_url) id
  FROM channels
  ORDER BY stream_url,
    -- Prefer rows with more metadata filled in
    (CASE WHEN name IS NOT NULL AND name != '' THEN 1 ELSE 0 END
     + CASE WHEN logo IS NOT NULL AND logo != '' THEN 1 ELSE 0 END
     + CASE WHEN country IS NOT NULL AND country != '' THEN 1 ELSE 0 END
     + CASE WHEN category IS NOT NULL AND category != '' THEN 1 ELSE 0 END) DESC,
    created_at ASC
);

-- Step 2: Add unique constraint on stream_url to prevent future duplicates
ALTER TABLE "channels" ADD CONSTRAINT "channels_stream_url_key" UNIQUE ("stream_url");

-- Step 3: Add indexes for filtered queries
CREATE INDEX "channels_category_idx" ON "channels"("category");
CREATE INDEX "channels_country_idx" ON "channels"("country");
CREATE INDEX "channels_language_idx" ON "channels"("language");
CREATE INDEX "channels_is_active_idx" ON "channels"("is_active");
CREATE INDEX "channels_active_country_idx" ON "channels"("is_active", "country");
CREATE INDEX "channels_active_category_idx" ON "channels"("is_active", "category");

-- Step 4: Update sort_order for Albanian priority
UPDATE channels SET sort_order = 10 WHERE country = 'AL';
UPDATE channels SET sort_order = 20 WHERE country = 'XK';
