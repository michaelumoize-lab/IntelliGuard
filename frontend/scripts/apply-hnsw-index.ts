import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Verifying indexes on face_embeddings...");
  const indexes: any = await prisma.$queryRawUnsafe(`
    SELECT indexname::text AS "indexName", indexdef::text AS "indexDef" 
    FROM pg_indexes 
    WHERE tablename = 'face_embeddings';
  `);
  console.log("Current indexes on face_embeddings:\n", JSON.stringify(indexes, null, 2));
}

main()
  .catch((e) => {
    console.error("Error checking indexes:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
