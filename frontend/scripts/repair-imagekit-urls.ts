import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getImageFileDetails } from "../lib/ai/imagekit";

async function repairImageKitUrls() {
  console.log("==================================================");
  console.log("  ImageKit Database Record Inspection & Repair");
  console.log("==================================================\n");

  const persons = await prisma.person.findMany({
    include: {
      faceEmbeddings: {
        where: { isActive: true },
      },
    },
  });

  console.log(`Inspecting ${persons.length} registered person records...\n`);

  let repairedCount = 0;
  let unverifiedCount = 0;
  let matchesCount = 0;

  for (const person of persons) {
    console.log(`Person ID ${person.id} (${person.personCode} - ${person.firstName} ${person.lastName}):`);
    console.log(` - Current faceImageUrl:    ${person.faceImageUrl}`);
    console.log(` - Current faceImageFileId: ${person.faceImageFileId}`);

    if (!person.faceImageFileId) {
      console.log(` ⚠️ Warning: No faceImageFileId stored for Person ID ${person.id}. Skipping cloud verification.\n`);
      unverifiedCount++;
      continue;
    }

    // Query ImageKit API using faceImageFileId to get true canonical delivery URL
    const ikDetails = await getImageFileDetails(person.faceImageFileId);

    if (!ikDetails || !ikDetails.url) {
      console.log(` ❌ Could not verify asset with ImageKit (fileId: ${person.faceImageFileId}). Record left unchanged.\n`);
      unverifiedCount++;
      continue;
    }

    const canonicalUrl = ikDetails.url;
    console.log(` - ImageKit Cloud Returned URL: ${canonicalUrl}`);

    const activeEmbedding = person.faceEmbeddings[0] || null;
    const urlMismatch = person.faceImageUrl !== canonicalUrl;
    const embeddingMismatch = activeEmbedding && activeEmbedding.imagePath !== canonicalUrl;

    if (urlMismatch || embeddingMismatch) {
      console.log(` 🛠️ Mismatch detected! Repairing record in PostgreSQL to match ImageKit canonical URL...`);

      await prisma.$transaction(async (tx) => {
        await tx.person.update({
          where: { id: person.id },
          data: { faceImageUrl: canonicalUrl },
        });

        if (activeEmbedding) {
          await tx.faceEmbedding.update({
            where: { id: activeEmbedding.id },
            data: { imagePath: canonicalUrl },
          });
        }
      });

      console.log(` ✅ Person ID ${person.id} updated successfully to: ${canonicalUrl}\n`);
      repairedCount++;
    } else {
      console.log(` ✅ Record is consistent with ImageKit cloud asset.\n`);
      matchesCount++;
    }
  }

  console.log("==================================================");
  console.log(`Summary:`);
  console.log(` - Consistent: ${matchesCount}`);
  console.log(` - Repaired:   ${repairedCount}`);
  console.log(` - Unverified: ${unverifiedCount}`);
  console.log("==================================================");
}

repairImageKitUrls()
  .catch((err) => {
    console.error("Fatal error during ImageKit record repair:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
