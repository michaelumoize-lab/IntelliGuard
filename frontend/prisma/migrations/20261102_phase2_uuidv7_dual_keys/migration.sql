-- IntelliGuard Phase 2: Additive UUIDv7 Identifiers & Dual-Key Relationships Migration
-- Target tables: persons, devices, face_embeddings, access_logs, alerts
-- Preserves existing integer primary keys, integer foreign keys, and Phase 1 business identifiers.

-- 1. Add nullable UUID columns for internal UUIDv7 identifiers
ALTER TABLE persons ADD COLUMN IF NOT EXISTS uuid_id UUID;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS uuid_id UUID;
ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS uuid_id UUID;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS uuid_id UUID;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS uuid_id UUID;

-- 2. Backfill existing records with native PostgreSQL uuidv7()
UPDATE persons SET uuid_id = uuidv7() WHERE uuid_id IS NULL;
UPDATE devices SET uuid_id = uuidv7() WHERE uuid_id IS NULL;
UPDATE face_embeddings SET uuid_id = uuidv7() WHERE uuid_id IS NULL;
UPDATE access_logs SET uuid_id = uuidv7() WHERE uuid_id IS NULL;
UPDATE alerts SET uuid_id = uuidv7() WHERE uuid_id IS NULL;

-- 3. Set NOT NULL and DEFAULT uuidv7() on all 5 tables
ALTER TABLE persons ALTER COLUMN uuid_id SET NOT NULL, ALTER COLUMN uuid_id SET DEFAULT uuidv7();
ALTER TABLE devices ALTER COLUMN uuid_id SET NOT NULL, ALTER COLUMN uuid_id SET DEFAULT uuidv7();
ALTER TABLE face_embeddings ALTER COLUMN uuid_id SET NOT NULL, ALTER COLUMN uuid_id SET DEFAULT uuidv7();
ALTER TABLE access_logs ALTER COLUMN uuid_id SET NOT NULL, ALTER COLUMN uuid_id SET DEFAULT uuidv7();
ALTER TABLE alerts ALTER COLUMN uuid_id SET NOT NULL, ALTER COLUMN uuid_id SET DEFAULT uuidv7();

-- 4. Create unique indexes and constraints on uuid_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_uuid_id ON persons(uuid_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_uuid_id ON devices(uuid_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_face_embeddings_uuid_id ON face_embeddings(uuid_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_logs_uuid_id ON access_logs(uuid_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_uuid_id ON alerts(uuid_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_persons_uuid_id') THEN
    ALTER TABLE persons ADD CONSTRAINT uq_persons_uuid_id UNIQUE USING INDEX idx_persons_uuid_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_devices_uuid_id') THEN
    ALTER TABLE devices ADD CONSTRAINT uq_devices_uuid_id UNIQUE USING INDEX idx_devices_uuid_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_face_embeddings_uuid_id') THEN
    ALTER TABLE face_embeddings ADD CONSTRAINT uq_face_embeddings_uuid_id UNIQUE USING INDEX idx_face_embeddings_uuid_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_access_logs_uuid_id') THEN
    ALTER TABLE access_logs ADD CONSTRAINT uq_access_logs_uuid_id UNIQUE USING INDEX idx_access_logs_uuid_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_alerts_uuid_id') THEN
    ALTER TABLE alerts ADD CONSTRAINT uq_alerts_uuid_id UNIQUE USING INDEX idx_alerts_uuid_id;
  END IF;
END $$;

-- 5. Add UUID foreign-key columns
ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS person_uuid_id UUID;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS device_uuid_id UUID;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS person_uuid_id UUID;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS embedding_uuid_id UUID;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS device_uuid_id UUID;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS person_uuid_id UUID;

-- 6. Backfill UUID foreign keys using existing integer relationships
UPDATE face_embeddings fe
SET person_uuid_id = p.uuid_id
FROM persons p
WHERE fe.person_id = p.id
  AND fe.person_uuid_id IS NULL;

UPDATE access_logs al
SET device_uuid_id = d.uuid_id
FROM devices d
WHERE al.device_id = d.id
  AND al.device_uuid_id IS NULL;

UPDATE access_logs al
SET person_uuid_id = p.uuid_id
FROM persons p
WHERE al.person_id = p.id
  AND al.person_uuid_id IS NULL;

UPDATE access_logs al
SET embedding_uuid_id = fe.uuid_id
FROM face_embeddings fe
WHERE al.embedding_id = fe.id
  AND al.embedding_uuid_id IS NULL;

UPDATE alerts a
SET device_uuid_id = d.uuid_id
FROM devices d
WHERE a.device_id = d.id
  AND a.device_uuid_id IS NULL;

UPDATE alerts a
SET person_uuid_id = p.uuid_id
FROM persons p
WHERE a.person_id = p.id
  AND a.person_uuid_id IS NULL;

-- 7. Enforce foreign-key constraints on UUID relationships
ALTER TABLE face_embeddings ALTER COLUMN person_uuid_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_face_embeddings_person_uuid') THEN
    ALTER TABLE face_embeddings ADD CONSTRAINT fk_face_embeddings_person_uuid 
      FOREIGN KEY (person_uuid_id) REFERENCES persons(uuid_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_access_logs_device_uuid') THEN
    ALTER TABLE access_logs ADD CONSTRAINT fk_access_logs_device_uuid 
      FOREIGN KEY (device_uuid_id) REFERENCES devices(uuid_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_access_logs_person_uuid') THEN
    ALTER TABLE access_logs ADD CONSTRAINT fk_access_logs_person_uuid 
      FOREIGN KEY (person_uuid_id) REFERENCES persons(uuid_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_access_logs_embedding_uuid') THEN
    ALTER TABLE access_logs ADD CONSTRAINT fk_access_logs_embedding_uuid 
      FOREIGN KEY (embedding_uuid_id) REFERENCES face_embeddings(uuid_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_alerts_device_uuid') THEN
    ALTER TABLE alerts ADD CONSTRAINT fk_alerts_device_uuid 
      FOREIGN KEY (device_uuid_id) REFERENCES devices(uuid_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_alerts_person_uuid') THEN
    ALTER TABLE alerts ADD CONSTRAINT fk_alerts_person_uuid 
      FOREIGN KEY (person_uuid_id) REFERENCES persons(uuid_id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Add indexes on UUID foreign-key columns
CREATE INDEX IF NOT EXISTS idx_face_embedding_person_uuid ON face_embeddings(person_uuid_id);
CREATE INDEX IF NOT EXISTS idx_accesslog_device_uuid ON access_logs(device_uuid_id);
CREATE INDEX IF NOT EXISTS idx_accesslog_person_uuid ON access_logs(person_uuid_id);
CREATE INDEX IF NOT EXISTS idx_accesslog_embedding_uuid ON access_logs(embedding_uuid_id);
CREATE INDEX IF NOT EXISTS idx_alerts_device_uuid ON alerts(device_uuid_id);
CREATE INDEX IF NOT EXISTS idx_alerts_person_uuid ON alerts(person_uuid_id);

-- 9. Automatic Dual-Key Synchronization Triggers
CREATE OR REPLACE FUNCTION sync_face_embedding_keys()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.person_id IS NOT NULL AND NEW.person_uuid_id IS NULL THEN
    SELECT uuid_id INTO NEW.person_uuid_id FROM persons WHERE id = NEW.person_id;
  ELSIF NEW.person_uuid_id IS NOT NULL AND NEW.person_id IS NULL THEN
    SELECT id INTO NEW.person_id FROM persons WHERE uuid_id = NEW.person_uuid_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_face_embedding_keys ON face_embeddings;
CREATE TRIGGER trg_sync_face_embedding_keys
BEFORE INSERT OR UPDATE ON face_embeddings
FOR EACH ROW EXECUTE FUNCTION sync_face_embedding_keys();

CREATE OR REPLACE FUNCTION sync_access_log_keys()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.person_id IS NOT NULL AND NEW.person_uuid_id IS NULL THEN
    SELECT uuid_id INTO NEW.person_uuid_id FROM persons WHERE id = NEW.person_id;
  ELSIF NEW.person_uuid_id IS NOT NULL AND NEW.person_id IS NULL THEN
    SELECT id INTO NEW.person_id FROM persons WHERE uuid_id = NEW.person_uuid_id;
  END IF;

  IF NEW.device_id IS NOT NULL AND NEW.device_uuid_id IS NULL THEN
    SELECT uuid_id INTO NEW.device_uuid_id FROM devices WHERE id = NEW.device_id;
  ELSIF NEW.device_uuid_id IS NOT NULL AND NEW.device_id IS NULL THEN
    SELECT id INTO NEW.device_id FROM devices WHERE uuid_id = NEW.device_uuid_id;
  END IF;

  IF NEW.embedding_id IS NOT NULL AND NEW.embedding_uuid_id IS NULL THEN
    SELECT uuid_id INTO NEW.embedding_uuid_id FROM face_embeddings WHERE id = NEW.embedding_id;
  ELSIF NEW.embedding_uuid_id IS NOT NULL AND NEW.embedding_id IS NULL THEN
    SELECT id INTO NEW.embedding_id FROM face_embeddings WHERE uuid_id = NEW.embedding_uuid_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_access_log_keys ON access_logs;
CREATE TRIGGER trg_sync_access_log_keys
BEFORE INSERT OR UPDATE ON access_logs
FOR EACH ROW EXECUTE FUNCTION sync_access_log_keys();

CREATE OR REPLACE FUNCTION sync_alert_keys()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.person_id IS NOT NULL AND NEW.person_uuid_id IS NULL THEN
    SELECT uuid_id INTO NEW.person_uuid_id FROM persons WHERE id = NEW.person_id;
  ELSIF NEW.person_uuid_id IS NOT NULL AND NEW.person_id IS NULL THEN
    SELECT id INTO NEW.person_id FROM persons WHERE uuid_id = NEW.person_uuid_id;
  END IF;

  IF NEW.device_id IS NOT NULL AND NEW.device_uuid_id IS NULL THEN
    SELECT uuid_id INTO NEW.device_uuid_id FROM devices WHERE id = NEW.device_id;
  ELSIF NEW.device_uuid_id IS NOT NULL AND NEW.device_id IS NULL THEN
    SELECT id INTO NEW.device_id FROM devices WHERE uuid_id = NEW.device_uuid_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_alert_keys ON alerts;
CREATE TRIGGER trg_sync_alert_keys
BEFORE INSERT OR UPDATE ON alerts
FOR EACH ROW EXECUTE FUNCTION sync_alert_keys();
