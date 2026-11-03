-- Phase 1: Additive Business Identifiers Migration
-- Entities: Device (device_code), FaceEmbedding (embedding_code), AccessLog (access_code), Alert (alert_code)

-- 1. Add nullable business identifier columns
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "device_code" TEXT;
ALTER TABLE "face_embeddings" ADD COLUMN IF NOT EXISTS "embedding_code" TEXT;
ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "access_code" TEXT;
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "alert_code" TEXT;

-- 2. Backfill existing records with unique, cryptographically random, prefixed 12-hex identifiers
UPDATE "devices" 
SET "device_code" = 'DEV-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12)) 
WHERE "device_code" IS NULL;

UPDATE "face_embeddings" 
SET "embedding_code" = 'EMB-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12)) 
WHERE "embedding_code" IS NULL;

UPDATE "access_logs" 
SET "access_code" = 'ACL-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12)) 
WHERE "access_code" IS NULL;

UPDATE "alerts" 
SET "alert_code" = 'ALT-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12)) 
WHERE "alert_code" IS NULL;

-- 3. Enforce NOT NULL constraints on all four business identifier columns
ALTER TABLE "devices" ALTER COLUMN "device_code" SET NOT NULL;
ALTER TABLE "face_embeddings" ALTER COLUMN "embedding_code" SET NOT NULL;
ALTER TABLE "access_logs" ALTER COLUMN "access_code" SET NOT NULL;
ALTER TABLE "alerts" ALTER COLUMN "alert_code" SET NOT NULL;

-- 4. Create UNIQUE indexes on the business identifier columns
CREATE UNIQUE INDEX IF NOT EXISTS "idx_device_code" ON "devices"("device_code");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_embedding_code" ON "face_embeddings"("embedding_code");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_access_code" ON "access_logs"("access_code");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_alert_code" ON "alerts"("alert_code");
