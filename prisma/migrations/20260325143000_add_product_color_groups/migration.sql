-- Create enum for product options when it does not exist yet.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductOptionType') THEN
    CREATE TYPE "ProductOptionType" AS ENUM ('COLOR', 'SIZE');
  END IF;
END $$;

-- Create normalized option tables.
CREATE TABLE IF NOT EXISTS "product_options" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "name" "ProductOptionType" NOT NULL,
  CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_option_values" (
  "id" TEXT NOT NULL,
  "option_id" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "hex_color" TEXT,
  CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id")
);

-- Add color-group key for product images (NULL means fallback images).
ALTER TABLE "product_images"
  ADD COLUMN IF NOT EXISTS "option_value_id" TEXT;

-- Add strict color/size references on variants. Keep nullable first to backfill safely.
ALTER TABLE "variants"
  ADD COLUMN IF NOT EXISTS "color_option_value_id" TEXT,
  ADD COLUMN IF NOT EXISTS "size_option_value_id" TEXT;

-- Ensure each product has COLOR and SIZE option rows before linking values.
INSERT INTO "product_options" ("id", "product_id", "name")
SELECT md5(v."product_id" || ':COLOR'), v."product_id", 'COLOR'::"ProductOptionType"
FROM "variants" v
GROUP BY v."product_id"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "product_options" ("id", "product_id", "name")
SELECT md5(v."product_id" || ':SIZE'), v."product_id", 'SIZE'::"ProductOptionType"
FROM "variants" v
GROUP BY v."product_id"
ON CONFLICT ("id") DO NOTHING;

-- Backfill distinct color and size values from variants.
INSERT INTO "product_option_values" ("id", "option_id", "value", "hex_color")
SELECT
  md5(v."product_id" || ':COLOR:' || trim(v."color")),
  po."id",
  trim(v."color"),
  NULL
FROM "variants" v
JOIN "product_options" po
  ON po."product_id" = v."product_id" AND po."name" = 'COLOR'
GROUP BY v."product_id", po."id", trim(v."color")
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "product_option_values" ("id", "option_id", "value")
SELECT
  md5(v."product_id" || ':SIZE:' || trim(v."size")),
  po."id",
  trim(v."size")
FROM "variants" v
JOIN "product_options" po
  ON po."product_id" = v."product_id" AND po."name" = 'SIZE'
GROUP BY v."product_id", po."id", trim(v."size")
ON CONFLICT ("id") DO NOTHING;

-- Preserve existing hex colors when available.
UPDATE "product_option_values" pov
SET "hex_color" = src."hex_color"
FROM (
  SELECT DISTINCT ON (v."product_id", trim(v."color"))
    v."product_id",
    trim(v."color") AS "color",
    v."hex_color"
  FROM "variants" v
  WHERE v."hex_color" IS NOT NULL
) src
JOIN "product_options" po
  ON po."product_id" = src."product_id" AND po."name" = 'COLOR'
WHERE pov."option_id" = po."id"
  AND pov."value" = src."color"
  AND pov."hex_color" IS NULL;

-- Link each variant to exactly one color value and one size value.
UPDATE "variants" v
SET "color_option_value_id" = pov."id"
FROM "product_option_values" pov
JOIN "product_options" po
  ON po."id" = pov."option_id" AND po."name" = 'COLOR'
WHERE po."product_id" = v."product_id"
  AND pov."value" = trim(v."color")
  AND v."color_option_value_id" IS NULL;

UPDATE "variants" v
SET "size_option_value_id" = pov."id"
FROM "product_option_values" pov
JOIN "product_options" po
  ON po."id" = pov."option_id" AND po."name" = 'SIZE'
WHERE po."product_id" = v."product_id"
  AND pov."value" = trim(v."size")
  AND v."size_option_value_id" IS NULL;

-- Move old variant-level images into color-group product images when legacy table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'variant_images'
  ) THEN
    INSERT INTO "product_images" (
      "id",
      "product_id",
      "file_id",
      "option_value_id",
      "is_primary",
      "position",
      "created_at"
    )
    SELECT
      md5('variant-image:' || vi."id"),
      v."product_id",
      vi."file_id",
      v."color_option_value_id",
      vi."is_primary",
      vi."position",
      COALESCE(vi."created_at", CURRENT_TIMESTAMP)
    FROM "variant_images" vi
    JOIN "variants" v ON v."id" = vi."variant_id"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- Enforce strict variant key and remove legacy columns/table.
ALTER TABLE "variants"
  ALTER COLUMN "color_option_value_id" SET NOT NULL,
  ALTER COLUMN "size_option_value_id" SET NOT NULL;

ALTER TABLE "variants"
  DROP COLUMN IF EXISTS "color",
  DROP COLUMN IF EXISTS "size",
  DROP COLUMN IF EXISTS "hex_color";

DROP TABLE IF EXISTS "variant_images";

CREATE INDEX IF NOT EXISTS "product_options_product_id_idx" ON "product_options"("product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_options_product_id_name_key" ON "product_options"("product_id", "name");
CREATE INDEX IF NOT EXISTS "product_option_values_option_id_idx" ON "product_option_values"("option_id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_option_values_option_id_value_key" ON "product_option_values"("option_id", "value");
CREATE INDEX IF NOT EXISTS "product_images_option_value_id_idx" ON "product_images"("option_value_id");
CREATE INDEX IF NOT EXISTS "variants_color_option_value_id_idx" ON "variants"("color_option_value_id");
CREATE INDEX IF NOT EXISTS "variants_size_option_value_id_idx" ON "variants"("size_option_value_id");
CREATE UNIQUE INDEX IF NOT EXISTS "variants_product_color_size_unique" ON "variants"("product_id", "color_option_value_id", "size_option_value_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_images_option_value_id_fkey'
  ) THEN
    ALTER TABLE "product_images"
      ADD CONSTRAINT "product_images_option_value_id_fkey"
      FOREIGN KEY ("option_value_id") REFERENCES "product_option_values"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'variants_color_option_value_id_fkey'
  ) THEN
    ALTER TABLE "variants"
      ADD CONSTRAINT "variants_color_option_value_id_fkey"
      FOREIGN KEY ("color_option_value_id") REFERENCES "product_option_values"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'variants_size_option_value_id_fkey'
  ) THEN
    ALTER TABLE "variants"
      ADD CONSTRAINT "variants_size_option_value_id_fkey"
      FOREIGN KEY ("size_option_value_id") REFERENCES "product_option_values"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_options_product_id_fkey'
  ) THEN
    ALTER TABLE "product_options"
      ADD CONSTRAINT "product_options_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_option_values_option_id_fkey'
  ) THEN
    ALTER TABLE "product_option_values"
      ADD CONSTRAINT "product_option_values_option_id_fkey"
      FOREIGN KEY ("option_id") REFERENCES "product_options"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
