-- CreateTable
CREATE TABLE "entity_sequences" (
    "key" TEXT NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_sequences_pkey" PRIMARY KEY ("key")
);

-- Seed user sequence from existing user codes to avoid duplicate codes after rollout
INSERT INTO "entity_sequences" ("key", "current_value", "updated_at")
SELECT
    'USER',
    COALESCE(MAX(CAST(regexp_replace("code", '^USER-(\\d+)$', '\\1') AS INTEGER)), 0),
    CURRENT_TIMESTAMP
FROM "users"
WHERE "code" ~ '^USER-[0-9]+$';
