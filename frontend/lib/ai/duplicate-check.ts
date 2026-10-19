import { prisma } from "@/lib/prisma";

export const REQUIRED_DUPLICATE_MESSAGE =
  "This face has already been registered. Please check the existing person records before proceeding.";

const parsedThreshold = parseFloat(
  process.env.FACE_DUPLICATE_THRESHOLD || process.env.FACE_MATCH_THRESHOLD || "0.50"
);
export const DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD = Number.isFinite(parsedThreshold)
  ? parsedThreshold
  : 0.50;

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

export type DuplicateCheckDbClient = Pick<typeof prisma, "faceEmbedding" | "$queryRawUnsafe">;

/**
 * Validates that a candidate facial embedding is a 512-dimensional array of finite numbers with non-zero L2 norm.
 * Throws an Error if the embedding is missing or malformed so duplicate checks never fail open.
 */
export function validateEmbeddingVector(embedding: unknown): asserts embedding is number[] {
  if (!Array.isArray(embedding) || embedding.length !== 512) {
    throw new Error(
      "Invalid facial embedding vector: must be a 512-dimensional array of finite numbers."
    );
  }

  let normSquared = 0;
  for (let i = 0; i < embedding.length; i++) {
    const val = embedding[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(
        `Invalid facial embedding vector: element at index ${i} is not a finite number.`
      );
    }
    normSquared += val * val;
  }

  if (normSquared <= 1e-12) {
    throw new Error(
      "Invalid facial embedding vector: embedding has zero norm."
    );
  }
}

/**
 * Perform native PostgreSQL + pgvector cosine similarity search to check if a duplicate face exists.
 * 
 * Uses DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD (0.50 for InsightFace buffalo_s cosine similarity,
 * matching FACE_MATCH_THRESHOLD) unless explicitly overridden.
 * Supports excludePersonId so face replacement on an existing person does not flag their own prior face.
 * Checks active, inactive, and suspended persons to prevent deactivated or suspended individuals from being re-enrolled.
 */
export async function checkForDuplicateFace(
  embedding: number[],
  similarityThreshold: number = DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
  excludePersonId?: number,
  modelName: string = "buffalo_s",
  dbClient: DuplicateCheckDbClient = prisma
): Promise<DuplicateCheckResult> {
  validateEmbeddingVector(embedding);

  const effectiveThreshold = Number.isFinite(similarityThreshold)
    ? similarityThreshold
    : DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD;

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

    // Check if active embeddings exist on other models to prevent silent skipping
    const mismatchedEmbedding = await dbClient.faceEmbedding.findFirst({
      where: {
        isActive: true,
        NOT: {
          embeddingModel: {
            equals: modelName,
            mode: "insensitive",
          },
        },
      },
      select: {
        id: true,
        embeddingModel: true,
        personId: true,
      },
    });

    if (mismatchedEmbedding) {
      console.warn(
        `Active face embedding #${mismatchedEmbedding.id} for person #${mismatchedEmbedding.personId} uses model '${mismatchedEmbedding.embeddingModel}', which does not match active duplicate-check model '${modelName}'. Active embeddings must be re-embedded with '${modelName}'.`
      );
    }

    if (excludePersonId !== undefined && excludePersonId !== null) {
      results = await dbClient.$queryRawUnsafe(
        `
        SELECT 
          fe.person_id AS "personId", 
          p.person_code AS "personCode",
          p.first_name AS "firstName", 
          p.last_name AS "lastName", 
          p.status::text AS "status",
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
      results = await dbClient.$queryRawUnsafe(
        `
        SELECT 
          fe.person_id AS "personId", 
          p.person_code AS "personCode",
          p.first_name AS "firstName", 
          p.last_name AS "lastName", 
          p.status::text AS "status",
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

      if (similarity >= effectiveThreshold) {
        return {
          isDuplicate: true,
          matchingPerson: {
            personId: Number(topMatch.personId),
            personCode: topMatch.personCode,
            firstName: topMatch.firstName,
            lastName: topMatch.lastName,
            status: String(topMatch.status),
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
