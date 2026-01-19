-- CreateTable
CREATE TABLE "playlist_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlist_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "playlist_tokens_user_id_key" ON "playlist_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_tokens_token_key" ON "playlist_tokens"("token");

-- AddForeignKey
ALTER TABLE "playlist_tokens" ADD CONSTRAINT "playlist_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
