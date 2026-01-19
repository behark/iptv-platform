-- Drop unique index on user_id so multiple devices per user are allowed
DROP INDEX IF EXISTS "playlist_tokens_user_id_key";

-- Add optional device_id column
ALTER TABLE "playlist_tokens" ADD COLUMN "device_id" TEXT;

-- Add foreign key for device
ALTER TABLE "playlist_tokens" ADD CONSTRAINT "playlist_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce uniqueness per device
CREATE UNIQUE INDEX "playlist_tokens_device_id_key" ON "playlist_tokens"("device_id");
