-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "PersonCategory" AS ENUM ('employee', 'student', 'visitor', 'contractor');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('camera', 'access_control', 'sensor', 'iot');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('online', 'offline', 'maintenance', 'error');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('matched', 'unknown', 'ambiguous', 'rejected');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('granted', 'denied');

-- CreateEnum
CREATE TYPE "AccessReason" AS ENUM ('face_match', 'face_no_match', 'insufficient_confidence', 'time_restriction', 'manual_override', 'system_error', 'spoof_detected', 'unauthorized');

-- CreateEnum
CREATE TYPE "DoorAction" AS ENUM ('unlock', 'lock', 'no_action');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('unauthorized_access', 'unknown_face', 'device_offline', 'system_error');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" SERIAL NOT NULL,
    "person_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "category" "PersonCategory" NOT NULL,
    "department" VARCHAR(100),
    "status" "PersonStatus" NOT NULL DEFAULT 'active',
    "face_image_url" TEXT,
    "face_image_file_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_embeddings" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "embedding" vector(512) NOT NULL,
    "embedding_model" VARCHAR(100) NOT NULL DEFAULT 'buffalo_s',
    "embedding_model_version" VARCHAR(50),
    "image_path" TEXT NOT NULL,
    "image_hash" TEXT,
    "quality_score" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "device_name" VARCHAR(100) NOT NULL,
    "serial_number" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "location" VARCHAR(150) NOT NULL,
    "ip_address" TEXT,
    "firmware_version" TEXT,
    "device_type" "DeviceType" NOT NULL DEFAULT 'camera',
    "status" "DeviceStatus" NOT NULL DEFAULT 'offline',
    "last_seen" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER,
    "person_id" INTEGER,
    "embedding_id" INTEGER,
    "match_status" "MatchStatus" NOT NULL,
    "access_status" "AccessStatus" NOT NULL,
    "reason" "AccessReason" NOT NULL,
    "door_action" "DoorAction" NOT NULL DEFAULT 'no_action',
    "confidence_score" DOUBLE PRECISION,
    "embedding_distance" DOUBLE PRECISION,
    "captured_image_path" TEXT,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER,
    "person_id" INTEGER,
    "alert_type" "AlertType" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'medium',
    "image_path" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "persons_person_code_key" ON "persons"("person_code");

-- CreateIndex
CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");

-- CreateIndex
CREATE UNIQUE INDEX "persons_phone_key" ON "persons"("phone");

-- CreateIndex
CREATE INDEX "idx_person_code" ON "persons"("person_code");

-- CreateIndex
CREATE INDEX "idx_person_status" ON "persons"("status");

-- CreateIndex
CREATE UNIQUE INDEX "face_embeddings_image_hash_key" ON "face_embeddings"("image_hash");

-- CreateIndex
CREATE INDEX "idx_face_embedding_active" ON "face_embeddings"("is_active");

-- CreateIndex
CREATE INDEX "idx_face_embedding_person" ON "face_embeddings"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serial_number_key" ON "devices"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "devices_api_key_hash_key" ON "devices"("api_key_hash");

-- CreateIndex
CREATE INDEX "idx_device_serial" ON "devices"("serial_number");

-- CreateIndex
CREATE INDEX "idx_device_api_key_hash" ON "devices"("api_key_hash");

-- CreateIndex
CREATE INDEX "idx_accesslog_device" ON "access_logs"("device_id");

-- CreateIndex
CREATE INDEX "idx_accesslog_person" ON "access_logs"("person_id");

-- CreateIndex
CREATE INDEX "idx_accesslog_created" ON "access_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_accesslog_status" ON "access_logs"("access_status");

-- CreateIndex
CREATE INDEX "idx_alert_resolved" ON "alerts"("resolved");

-- CreateIndex
CREATE INDEX "idx_alert_created" ON "alerts"("created_at");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_embedding_id_fkey" FOREIGN KEY ("embedding_id") REFERENCES "face_embeddings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateHNSWIndex
CREATE INDEX IF NOT EXISTS "idx_face_embeddings_hnsw" ON "face_embeddings" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
