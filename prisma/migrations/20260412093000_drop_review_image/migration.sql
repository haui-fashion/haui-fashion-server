-- Drop review image relation and backing column.
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_image_id_fkey";
DROP INDEX IF EXISTS "reviews_image_id_idx";
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "image_id";
