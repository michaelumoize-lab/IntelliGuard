-- AlterEnum: Add 'spoof_detected' and 'unauthorized' to AccessReason enum
ALTER TYPE "AccessReason" ADD VALUE IF NOT EXISTS 'spoof_detected';
ALTER TYPE "AccessReason" ADD VALUE IF NOT EXISTS 'unauthorized';

-- AlterTable: Update default embedding_model on face_embeddings to 'buffalo_s'
ALTER TABLE "face_embeddings" ALTER COLUMN "embedding_model" SET DEFAULT 'buffalo_s';
