import "dotenv/config";
import { prisma } from "../lib/prisma";
import { generateEmbedding } from "../lib/ai/fastapi";

/**
 * Re-embeds any legacy FaceEmbedding records created with 'buffalo_l' (or non-'buffalo_s' models)
 * using the stored imageUrl (or person.faceImageUrl) so all vectors in PostgreSQL share the
 * consistent 'buffalo_s' 512D embedding space.
 */
async function reenrollBuffaloS() {
  console.log("Scanning face_embeddings for non-buffalo_s records...");

  const legacyRecords = await prisma.faceEmbedding.findMany({
    where: {
      NOT: {
        embeddingModel: "buffalo_s",
      },
    },
    include: {
      person: {
        select: {
          id: true,
          personCode: true,
          firstName: true,
          lastName: true,
          faceImageUrl: true,
        },
      },
    },
  });

  if (legacyRecords.length === 0) {
    console.log("All face_embeddings records already use 'buffalo_s'. Nothing to migrate.");
    return;
  }

  console.log(`Found ${legacyRecords.length} record(s) to re-embed with 'buffalo_s'.`);

  let updated = 0;
  let skipped = 0;

  for (const record of legacyRecords) {
    const sourceUrl = record.imagePath || record.person?.faceImageUrl;
    if (!sourceUrl) {
      console.warn(
        `[SKIP] FaceEmbedding #${record.id} (personId=${record.personId}) has no stored imagePath.`
      );
      skipped++;
      continue;
    }

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching image from ${sourceUrl}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      const embeddingResult = await generateEmbedding(
        imageBuffer,
        `reenroll_${record.personId}_${record.id}.jpg`
      );
      const vectorString = `[${embeddingResult.embedding.join(",")}]`;

      await prisma.$executeRaw`
        UPDATE "face_embeddings"
        SET
          "embedding" = ${vectorString}::vector,
          "embedding_model" = 'buffalo_s',
          "quality_score" = ${embeddingResult.qualityScore ?? record.qualityScore}
        WHERE "id" = ${record.id}
      `;

      console.log(
        `[OK] Re-embedded FaceEmbedding #${record.id} for person ${record.person?.personCode ?? record.personId} -> buffalo_s`
      );
      updated++;
    } catch (err) {
      console.error(
        `[ERR] Failed to re-embed FaceEmbedding #${record.id} (personId=${record.personId}):`,
        err
      );
      skipped++;
    }
  }

  console.log(`Done. Updated: ${updated}, Skipped/Failed: ${skipped}`);
}

reenrollBuffaloS()
  .catch((err) => {
    console.error("Fatal error during buffalo_s re-enrollment:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
