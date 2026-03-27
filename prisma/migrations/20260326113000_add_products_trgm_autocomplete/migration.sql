CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT unaccent($1)
$$;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
ON products USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
ON products USING gin (immutable_unaccent(lower(COALESCE(brand, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_slug_trgm
ON products USING gin (immutable_unaccent(lower(slug)) gin_trgm_ops);
