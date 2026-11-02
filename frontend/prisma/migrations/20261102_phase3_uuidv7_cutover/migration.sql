-- IntelliGuard Phase 3: UUIDv7 Primary-Key Cutover Migration
-- Migrates primary keys of persons, devices, face_embeddings, access_logs, alerts to UUIDv7 (uuid_id).
-- Removes old integer foreign-key constraints and establishes UUID foreign keys as active relationships.

-- 1. Drop old integer foreign-key constraints
ALTER TABLE face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_person_id_fkey;
ALTER TABLE access_logs DROP CONSTRAINT IF EXISTS access_logs_person_id_fkey;
ALTER TABLE access_logs DROP CONSTRAINT IF EXISTS access_logs_device_id_fkey;
ALTER TABLE access_logs DROP CONSTRAINT IF EXISTS access_logs_embedding_id_fkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_person_id_fkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_device_id_fkey;

-- 2. Drop old integer primary-key constraints
ALTER TABLE persons DROP CONSTRAINT IF EXISTS persons_pkey;
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_pkey;
ALTER TABLE face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_pkey;
ALTER TABLE access_logs DROP CONSTRAINT IF EXISTS access_logs_pkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_pkey;

-- 3. Add UUIDv7 primary-key constraints
ALTER TABLE persons ADD CONSTRAINT persons_pkey PRIMARY KEY (uuid_id);
ALTER TABLE devices ADD CONSTRAINT devices_pkey PRIMARY KEY (uuid_id);
ALTER TABLE face_embeddings ADD CONSTRAINT face_embeddings_pkey PRIMARY KEY (uuid_id);
ALTER TABLE access_logs ADD CONSTRAINT access_logs_pkey PRIMARY KEY (uuid_id);
ALTER TABLE alerts ADD CONSTRAINT alerts_pkey PRIMARY KEY (uuid_id);

-- 4. Mark old integer columns as nullable deprecated shadow columns
ALTER TABLE persons ALTER COLUMN id DROP NOT NULL;
ALTER TABLE devices ALTER COLUMN id DROP NOT NULL;
ALTER TABLE face_embeddings ALTER COLUMN id DROP NOT NULL;
ALTER TABLE access_logs ALTER COLUMN id DROP NOT NULL;
ALTER TABLE alerts ALTER COLUMN id DROP NOT NULL;
