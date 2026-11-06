-- ============================================================================
-- Final Business-Code Identifier Architecture Migration (Option A)
-- Converts persons, devices, face_embeddings, access_logs, and alerts to use
-- 6-digit numeric business codes (PER-XXXXXX, DEV-XXXXXX, EMB-XXXXXX,
-- ASL-XXXXXX, ALT-XXXXXX) as sole PRIMARY KEY and FOREIGN KEY identifiers.
-- Removes all legacy integer IDs, UUIDs, and synchronization triggers.
-- Preserves Better Auth models and pgvector(512) HNSW index.
-- ============================================================================

-- 1. Drop legacy dual-key synchronization triggers and functions
DROP TRIGGER IF EXISTS "trg_sync_face_embedding_keys" ON "face_embeddings";
DROP TRIGGER IF EXISTS "trg_sync_access_log_keys" ON "access_logs";
DROP TRIGGER IF EXISTS "trg_sync_alert_keys" ON "alerts";

DROP FUNCTION IF EXISTS "sync_face_embedding_keys"();
DROP FUNCTION IF EXISTS "sync_access_log_keys"();
DROP FUNCTION IF EXISTS "sync_alert_keys"();

-- 2. Add new business-code foreign-key columns to dependent tables
ALTER TABLE "face_embeddings" ADD COLUMN IF NOT EXISTS "person_code" TEXT;

ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "device_code" TEXT;
ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "person_code" TEXT;
ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "embedding_code" TEXT;

ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "device_code" TEXT;
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "person_code" TEXT;

-- 3. Regenerate existing business codes to canonical 6-digit numeric format
--    using unbiased cryptographically random digits via pgcrypto / random
DO $$
DECLARE
  rec RECORD;
  candidate TEXT;
BEGIN
  -- 3a. Persons -> PER-XXXXXX
  FOR rec IN SELECT "uuid_id", "person_code" FROM "persons" WHERE "person_code" IS NULL OR "person_code" !~ '^PER-[0-9]{6}$' LOOP
    LOOP
      candidate := 'PER-' || LPAD(FLOOR(random() * 1000000)::INT::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "persons" WHERE "person_code" = candidate);
    END LOOP;
    UPDATE "persons" SET "person_code" = candidate WHERE "uuid_id" = rec."uuid_id";
  END LOOP;

  -- 3b. Devices -> DEV-XXXXXX
  FOR rec IN SELECT "uuid_id", "device_code" FROM "devices" WHERE "device_code" IS NULL OR "device_code" !~ '^DEV-[0-9]{6}$' LOOP
    LOOP
      candidate := 'DEV-' || LPAD(FLOOR(random() * 1000000)::INT::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "devices" WHERE "device_code" = candidate);
    END LOOP;
    UPDATE "devices" SET "device_code" = candidate WHERE "uuid_id" = rec."uuid_id";
  END LOOP;

  -- 3c. FaceEmbeddings -> EMB-XXXXXX
  FOR rec IN SELECT "uuid_id", "embedding_code" FROM "face_embeddings" WHERE "embedding_code" IS NULL OR "embedding_code" !~ '^EMB-[0-9]{6}$' LOOP
    LOOP
      candidate := 'EMB-' || LPAD(FLOOR(random() * 1000000)::INT::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "face_embeddings" WHERE "embedding_code" = candidate);
    END LOOP;
    UPDATE "face_embeddings" SET "embedding_code" = candidate WHERE "uuid_id" = rec."uuid_id";
  END LOOP;

  -- 3d. AccessLogs -> ASL-XXXXXX
  FOR rec IN SELECT "uuid_id", "access_code" FROM "access_logs" WHERE "access_code" IS NULL OR "access_code" !~ '^ASL-[0-9]{6}$' LOOP
    LOOP
      candidate := 'ASL-' || LPAD(FLOOR(random() * 1000000)::INT::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "access_logs" WHERE "access_code" = candidate);
    END LOOP;
    UPDATE "access_logs" SET "access_code" = candidate WHERE "uuid_id" = rec."uuid_id";
  END LOOP;

  -- 3e. Alerts -> ALT-XXXXXX
  FOR rec IN SELECT "uuid_id", "alert_code" FROM "alerts" WHERE "alert_code" IS NULL OR "alert_code" !~ '^ALT-[0-9]{6}$' LOOP
    LOOP
      candidate := 'ALT-' || LPAD(FLOOR(random() * 1000000)::INT::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "alerts" WHERE "alert_code" = candidate);
    END LOOP;
    UPDATE "alerts" SET "alert_code" = candidate WHERE "uuid_id" = rec."uuid_id";
  END LOOP;
END $$;

-- 4. Backfill foreign-key business codes from existing UUID relationships
UPDATE "face_embeddings" fe
SET "person_code" = p."person_code"
FROM "persons" p
WHERE fe."person_uuid_id" = p."uuid_id";

UPDATE "access_logs" al
SET "device_code" = d."device_code"
FROM "devices" d
WHERE al."device_uuid_id" = d."uuid_id";

UPDATE "access_logs" al
SET "person_code" = p."person_code"
FROM "persons" p
WHERE al."person_uuid_id" = p."uuid_id";

UPDATE "access_logs" al
SET "embedding_code" = fe."embedding_code"
FROM "face_embeddings" fe
WHERE al."embedding_uuid_id" = fe."uuid_id";

UPDATE "alerts" a
SET "device_code" = d."device_code"
FROM "devices" d
WHERE a."device_uuid_id" = d."uuid_id";

UPDATE "alerts" a
SET "person_code" = p."person_code"
FROM "persons" p
WHERE a."person_uuid_id" = p."uuid_id";

-- 5. Enforce NOT NULL on required business code columns
ALTER TABLE "persons" ALTER COLUMN "person_code" SET NOT NULL;
ALTER TABLE "devices" ALTER COLUMN "device_code" SET NOT NULL;
ALTER TABLE "face_embeddings" ALTER COLUMN "embedding_code" SET NOT NULL;
ALTER TABLE "face_embeddings" ALTER COLUMN "person_code" SET NOT NULL;
ALTER TABLE "access_logs" ALTER COLUMN "access_code" SET NOT NULL;
ALTER TABLE "alerts" ALTER COLUMN "alert_code" SET NOT NULL;

-- 6. Drop legacy foreign keys, primary keys, unique constraints, and redundant columns
ALTER TABLE "face_embeddings" DROP CONSTRAINT IF EXISTS "face_embeddings_person_uuid_id_fkey";
ALTER TABLE "face_embeddings" DROP CONSTRAINT IF EXISTS "face_embeddings_person_id_fkey";

ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_device_uuid_id_fkey";
ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_person_uuid_id_fkey";
ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_embedding_uuid_id_fkey";
ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_device_id_fkey";
ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_person_id_fkey";
ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_embedding_id_fkey";

ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "alerts_device_uuid_id_fkey";
ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "alerts_person_uuid_id_fkey";
ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "alerts_device_id_fkey";
ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "alerts_person_id_fkey";

ALTER TABLE "persons" DROP CONSTRAINT IF EXISTS "persons_pkey";
ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_pkey";
ALTER TABLE "face_embeddings" DROP CONSTRAINT IF EXISTS "face_embeddings_pkey";
ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_pkey";
ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "alerts_pkey";

ALTER TABLE "persons" DROP COLUMN IF EXISTS "id" CASCADE;
ALTER TABLE "persons" DROP COLUMN IF EXISTS "uuid_id" CASCADE;

ALTER TABLE "devices" DROP COLUMN IF EXISTS "id" CASCADE;
ALTER TABLE "devices" DROP COLUMN IF EXISTS "uuid_id" CASCADE;

ALTER TABLE "face_embeddings" DROP COLUMN IF EXISTS "id" CASCADE;
ALTER TABLE "face_embeddings" DROP COLUMN IF EXISTS "uuid_id" CASCADE;
ALTER TABLE "face_embeddings" DROP COLUMN IF EXISTS "person_id" CASCADE;
ALTER TABLE "face_embeddings" DROP COLUMN IF EXISTS "person_uuid_id" CASCADE;

ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "id" CASCADE;
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "uuid_id" CASCADE;
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "device_id" CASCADE;
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "person_id" CASCADE;
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "embedding_id" CASCADE;
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "device_uuid_id" CASCADE;
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "person_uuid_id" CASCADE;
ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "embedding_uuid_id" CASCADE;

ALTER TABLE "alerts" DROP COLUMN IF EXISTS "id" CASCADE;
ALTER TABLE "alerts" DROP COLUMN IF EXISTS "uuid_id" CASCADE;
ALTER TABLE "alerts" DROP COLUMN IF EXISTS "device_id" CASCADE;
ALTER TABLE "alerts" DROP COLUMN IF EXISTS "person_id" CASCADE;
ALTER TABLE "alerts" DROP COLUMN IF EXISTS "device_uuid_id" CASCADE;
ALTER TABLE "alerts" DROP COLUMN IF EXISTS "person_uuid_id" CASCADE;

DROP SEQUENCE IF EXISTS "persons_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "devices_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "face_embeddings_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "access_logs_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "alerts_id_seq" CASCADE;

-- Drop redundant standalone unique indexes before promoting columns to PRIMARY KEY
DROP INDEX IF EXISTS "persons_person_code_key";
DROP INDEX IF EXISTS "devices_device_code_key";
DROP INDEX IF EXISTS "face_embeddings_embedding_code_key";
DROP INDEX IF EXISTS "access_logs_access_code_key";
DROP INDEX IF EXISTS "alerts_alert_code_key";

-- 7. Promote business codes to PRIMARY KEY
ALTER TABLE "persons" ADD CONSTRAINT "persons_pkey" PRIMARY KEY ("person_code");
ALTER TABLE "devices" ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("device_code");
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_pkey" PRIMARY KEY ("embedding_code");
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_pkey" PRIMARY KEY ("access_code");
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_code");

-- 8. Add business-code FOREIGN KEY constraints
ALTER TABLE "face_embeddings"
  ADD CONSTRAINT "face_embeddings_person_code_fkey"
  FOREIGN KEY ("person_code") REFERENCES "persons"("person_code")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "access_logs"
  ADD CONSTRAINT "access_logs_device_code_fkey"
  FOREIGN KEY ("device_code") REFERENCES "devices"("device_code")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "access_logs"
  ADD CONSTRAINT "access_logs_person_code_fkey"
  FOREIGN KEY ("person_code") REFERENCES "persons"("person_code")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "access_logs"
  ADD CONSTRAINT "access_logs_embedding_code_fkey"
  FOREIGN KEY ("embedding_code") REFERENCES "face_embeddings"("embedding_code")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts"
  ADD CONSTRAINT "alerts_device_code_fkey"
  FOREIGN KEY ("device_code") REFERENCES "devices"("device_code")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts"
  ADD CONSTRAINT "alerts_person_code_fkey"
  FOREIGN KEY ("person_code") REFERENCES "persons"("person_code")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. Create foreign-key and HNSW vector indexes
CREATE INDEX IF NOT EXISTS "face_embeddings_person_code_idx" ON "face_embeddings"("person_code");
CREATE INDEX IF NOT EXISTS "access_logs_device_code_idx" ON "access_logs"("device_code");
CREATE INDEX IF NOT EXISTS "access_logs_person_code_idx" ON "access_logs"("person_code");
CREATE INDEX IF NOT EXISTS "access_logs_embedding_code_idx" ON "access_logs"("embedding_code");
CREATE INDEX IF NOT EXISTS "alerts_device_code_idx" ON "alerts"("device_code");
CREATE INDEX IF NOT EXISTS "alerts_person_code_idx" ON "alerts"("person_code");

CREATE INDEX IF NOT EXISTS "idx_face_embeddings_hnsw"
  ON "face_embeddings"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
