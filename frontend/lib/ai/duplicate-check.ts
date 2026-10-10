import { prisma } from "@/lib/prisma";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchingPerson?: {
    personId: number;
    personCode: string;
    firstName: string;
    lastName: string;
    status: string;
    similarity: number;
  };
}

/**
 * Perform native PostgreSQL + pgvector cosine similarity search to check if a duplicate face exists.
 * 
 * Supports excludePersonId so face replacement on an existing person does not flag their own prior face.
 * Also checks deactivated/suspended persons to prevent banned individuals from being re-enrolled.
 */
export async function checkForDuplicateFace(
  embedding: number[],
  similarityThreshold: number = 0.85,
  excludePersonId?: number,
  modelName: string = "buffalo_s"
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
      status: string;
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
          p.status AS "status",
          (1 - (fe.embedding <=> $1::vector)) AS "similarity"
        FROM face_embeddings fe
        JOIN persons p ON fe.person_id = p.id
        WHERE fe.is_active = true 
          AND LOWER(fe.embedding_model) = LOWER($3)
          AND fe.person_id != $2
        ORDER BY fe.embedding <=> $1::vector ASC
        LIMIT 1;
        `,
        vectorString,
        excludePersonId,
        modelName
      );
    } else {
      results = await prisma.$queryRawUnsafe(
        `
        SELECT 
          fe.person_id AS "personId", 
          p.person_code AS "personCode",
          p.first_name AS "firstName", 
          p.last_name AS "lastName", 
          p.status AS "status",
          (1 - (fe.embedding <=> $1::vector)) AS "similarity"
        FROM face_embeddings fe
        JOIN persons p ON fe.person_id = p.id
        WHERE fe.is_active = true 
          AND LOWER(fe.embedding_model) = LOWER($2)
        ORDER BY fe.embedding <=> $1::vector ASC
        LIMIT 1;
        `,
        vectorString,
        modelName
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
            status: topMatch.status,
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
