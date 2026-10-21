import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Checking and ensuring pgvector extension...");
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);

  console.log("Ensuring HNSW vector index on face_embeddings...");
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_face_embeddings_hnsw 
    ON face_embeddings 
    USING hnsw (embedding vector_cosine_ops) 
    WITH (m = 16, ef_construction = 64);
  `);

  console.log("Verifying indexes on face_embeddings...");
  const indexes = await prisma.$queryRawUnsafe<Array<{ indexName: string; indexDef: string }>>(`
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
