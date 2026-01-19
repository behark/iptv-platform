-- Add sort_order column to channels table
ALTER TABLE "channels" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 1000;

-- Create index for better sorting performance
CREATE INDEX "channels_sort_order_idx" ON "channels"("sort_order");
