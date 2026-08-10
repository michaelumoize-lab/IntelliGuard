import { prisma } from "@/lib/prisma";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchingPerson?: {
    personId: number;
    personCode: string;
    firstName: string;
    lastName: string;
    similarity: number;
  };
}

/**
 * Perform native PostgreSQL + pgvector cosine similarity search to check if a duplicate face exists.
 * 
 * Supports excludePersonId so face replacement on an existing person does not flag their own prior face.
 */
export async function checkForDuplicateFace(
  embedding: number[],
  similarityThreshold: number = 0.85,
  excludePersonId?: number
): Promise<DuplicateCheckResult> {
  if (!embedding || embedding.length !== 512) {
    return { isDuplicate: false };
  }

  // Format 512D float array into pgvector literal format: '[v1,v2,...,v512]'
  const vectorString = `[${embedding.join(",")}]`;

  try {
    let results: Array<{
      personId: number;
      personCode: string;
      firstName: string;
      lastName: string;
      similarity: number;
    }>;

    if (excludePersonId !== undefined && excludePersonId !== null) {
      results = await prisma.$queryRawUnsafe(
        `
        SELECT 
          fe.person_id AS "personId", 
          p.person_code AS "personCode",
          p.first_name AS "firstName", 
          p.last_name AS "lastName", 
          (1 - (fe.embedding <=> $1::vector)) AS "similarity"
        FROM face_embeddings fe
        JOIN persons p ON fe.person_id = p.id
        WHERE fe.is_active = true AND p.status = 'active' AND fe.person_id != $2
        ORDER BY fe.embedding <=> $1::vector ASC
        LIMIT 1;
        `,
        vectorString,
        excludePersonId
      );
    } else {
      results = await prisma.$queryRawUnsafe(
        `
        SELECT 
          fe.person_id AS "personId", 
          p.person_code AS "personCode",
          p.first_name AS "firstName", 
          p.last_name AS "lastName", 
          (1 - (fe.embedding <=> $1::vector)) AS "similarity"
        FROM face_embeddings fe
        JOIN persons p ON fe.person_id = p.id
        WHERE fe.is_active = true AND p.status = 'active'
        ORDER BY fe.embedding <=> $1::vector ASC
        LIMIT 1;
        `,
        vectorString
      );
    }

    if (results && results.length > 0) {
      const topMatch = results[0];
      const similarity = Number(topMatch.similarity);

      if (similarity >= similarityThreshold) {
        return {
          isDuplicate: true,
          matchingPerson: {
            personId: Number(topMatch.personId),
            personCode: topMatch.personCode,
            firstName: topMatch.firstName,
            lastName: topMatch.lastName,
            similarity: roundFloat(similarity, 4),
          },
        };
      }
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error("Error executing pgvector duplicate check in PostgreSQL:", error);
    throw error;
  }
}

function roundFloat(val: number, decimals: number): number {
  return Number(Math.fround(val).toFixed(decimals));
}
