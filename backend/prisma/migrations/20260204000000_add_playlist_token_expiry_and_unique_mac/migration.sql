-- AlterTable
ALTER TABLE "playlist_tokens" ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "devices_mac_address_key" ON "devices"("mac_address");
