import { prisma } from "@/lib/prisma";

export const DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD = Number(
  process.env.DUPLICATE_FACE_SIMILARITY_THRESHOLD || 0.5
);

export const EXPECTED_EMBEDDING_DIMENSION = 512;
export const DEFAULT_EMBEDDING_MODEL = "buffalo_s";

export const REQUIRED_DUPLICATE_MESSAGE =
  "Duplicate registration prevented. This individual is already registered in the system.";

export interface DuplicateFaceMatch {
  isDuplicate: boolean;
  matchingPerson: {
    personId: string;
    personCode: string;
    firstName: string;
    lastName: string;
    category: string;
    status: string;
    faceImageUrl: string | null;
    similarity: number;
    distance: number;
  } | null;
}

export type DuplicateCheckResult = DuplicateFaceMatch;

export class DuplicateCheckError extends Error {
  public readonly code:
    | "INVALID_EMBEDDING"
    | "MODEL_MISMATCH"
    | "DUPLICATE_CHECK_DB_ERROR";

  constructor(
    code: "INVALID_EMBEDDING" | "MODEL_MISMATCH" | "DUPLICATE_CHECK_DB_ERROR",
    message: string
  ) {
    super(message);
    this.name = "DuplicateCheckError";
    this.code = code;
  }
}

/**
 * Validates that an embedding vector is a valid 512D finite L2-normalized array.
 * Throws DuplicateCheckError("INVALID_EMBEDDING") if malformed.
 */
export function validateEmbeddingVector(embedding: unknown): number[] {
  if (!Array.isArray(embedding) || embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
    throw new DuplicateCheckError(
      "INVALID_EMBEDDING",
      `Invalid face embedding dimension: expected ${EXPECTED_EMBEDDING_DIMENSION}, received ${
        Array.isArray(embedding) ? embedding.length : typeof embedding
      }.`
    );
  }

  let normSquared = 0;
  const cleaned: number[] = new Array(EXPECTED_EMBEDDING_DIMENSION);

  for (let i = 0; i < EXPECTED_EMBEDDING_DIMENSION; i++) {
    const val = Number(embedding[i]);
    if (!Number.isFinite(val)) {
      throw new DuplicateCheckError(
        "INVALID_EMBEDDING",
        `Invalid face embedding value at index ${i}: non-finite number.`
      );
    }
    cleaned[i] = val;
    normSquared += val * val;
  }

  const norm = Math.sqrt(normSquared);
  if (!Number.isFinite(norm) || norm < 0.9 || norm > 1.1) {
    throw new DuplicateCheckError(
      "INVALID_EMBEDDING",
      `Invalid face embedding L2 norm (${norm.toFixed(4)}): expected unit-normalized vector (~1.0).`
    );
  }

  return cleaned;
}

export type DuplicateCheckDbClient = Pick<
  typeof prisma,
  "faceEmbedding" | "$queryRawUnsafe"
>;

/**
 * Queries PostgreSQL with pgvector cosine distance (`<=>`) across ALL registered persons
 * (regardless of person status: active, inactive, or suspended) to prevent duplicate identity enrollment.
 *
 * Fail-closed: throws DuplicateCheckError if the embedding is invalid, if active embeddings have
 * mismatched models, or if the database query fails.
 */
export async function checkForDuplicateFace(
  embedding: number[],
  similarityThreshold = DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
  excludePersonCode?: string,
  modelName = DEFAULT_EMBEDDING_MODEL,
  dbClient: DuplicateCheckDbClient = prisma
): Promise<DuplicateFaceMatch> {
  const validEmbedding = validateEmbeddingVector(embedding);
  const vectorString = `[${validEmbedding.join(",")}]`;

  const trimmedExclude = excludePersonCode !== undefined ? String(excludePersonCode).trim() : undefined;
  const hasExclusion = trimmedExclude !== undefined && trimmedExclude.length > 0;

  try {
    // Verify active embeddings in DB match the active model space
    const mismatchedEmbedding = await dbClient.faceEmbedding.findFirst({
      where: {
        isActive: true,
        NOT: {
          embeddingModel: modelName,
        },
      },
      select: {
        embeddingCode: true,
        personCode: true,
        embeddingModel: true,
      },
    });

    if (mismatchedEmbedding) {
      throw new DuplicateCheckError(
        "MODEL_MISMATCH",
        `Active face embedding ${mismatchedEmbedding.embeddingCode} for person ${mismatchedEmbedding.personCode} uses model '${mismatchedEmbedding.embeddingModel}', which does not match active duplicate-check model '${modelName}'. Active embeddings must be re-embedded with '${modelName}'.`
      );
    }

    const query = hasExclusion
      ? `
        SELECT 
          fe.person_code AS "personCode", 
          p.first_name AS "firstName", 
          p.last_name AS "lastName",
          p.category::text AS "category",
          p.status::text AS "status",
          p.face_image_url AS "faceImageUrl",
          1 - (fe.embedding <=> $1::vector) AS "similarity",
          (fe.embedding <=> $1::vector) AS "distance"
        FROM face_embeddings fe
        JOIN persons p ON fe.person_code = p.person_code
        WHERE fe.is_active = true
          AND fe.embedding_model = $3
          AND fe.person_code != $2
        ORDER BY fe.embedding <=> $1::vector ASC
        LIMIT 1;
      `
      : `
        SELECT 
          fe.person_code AS "personCode", 
          p.first_name AS "firstName", 
          p.last_name AS "lastName",
          p.category::text AS "category",
          p.status::text AS "status",
          p.face_image_url AS "faceImageUrl",
          1 - (fe.embedding <=> $1::vector) AS "similarity",
          (fe.embedding <=> $1::vector) AS "distance"
        FROM face_embeddings fe
        JOIN persons p ON fe.person_code = p.person_code
        WHERE fe.is_active = true
          AND fe.embedding_model = $2
        ORDER BY fe.embedding <=> $1::vector ASC
        LIMIT 1;
      `;

    const results = hasExclusion
      ? await dbClient.$queryRawUnsafe<
          Array<{
            personCode: string;
            firstName: string;
            lastName: string;
            category: string;
            status: string;
            faceImageUrl: string | null;
            similarity: number;
            distance: number;
          }>
        >(query, vectorString, trimmedExclude, modelName)
      : await dbClient.$queryRawUnsafe<
          Array<{
            personCode: string;
            firstName: string;
            lastName: string;
            category: string;
            status: string;
            faceImageUrl: string | null;
            similarity: number;
            distance: number;
          }>
        >(query, vectorString, modelName);

    if (!results || results.length === 0) {
      return { isDuplicate: false, matchingPerson: null };
    }

    const topMatch = results[0];
    const similarity = Number(topMatch.similarity);
    const distance = Number(topMatch.distance);
    const isDuplicate = similarity >= similarityThreshold;

    return {
      isDuplicate,
      matchingPerson: isDuplicate
        ? {
            personId: String(topMatch.personCode),
            personCode: String(topMatch.personCode),
            firstName: topMatch.firstName,
            lastName: topMatch.lastName,
            category: topMatch.category,
            status: topMatch.status,
            faceImageUrl: topMatch.faceImageUrl,
            similarity: Number(similarity.toFixed(4)),
            distance: Number(distance.toFixed(4)),
          }
        : null,
    };
  } catch (error) {
    if (error instanceof DuplicateCheckError) {
      throw error;
    }
    throw new DuplicateCheckError(
      "DUPLICATE_CHECK_DB_ERROR",
      error instanceof Error
        ? `Database error during duplicate face verification: ${error.message}`
        : "Database error during duplicate face verification."
    );
  }
}
