import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { validateEmbeddingVector } from "@/lib/ai/duplicate-check";

export interface FaceMatchCandidate {
  embeddingId: number;
  personId: number;
  personCode: string;
  firstName: string;
  lastName: string;
  category: string;
  department: string | null;
  status: string;
  qualityScore: number | null;
  embeddingModel: string;
  distance: number;
  similarity: number;
}

export interface RecognitionClassificationResult {
  matchStatus: "matched" | "unknown" | "ambiguous";
  person: {
    id: number;
    personCode: string;
    firstName: string;
    lastName: string;
    category: string;
    department: string | null;
    status?: string;
    faceImageUrl?: string | null;
  } | null;
  face: {
    embeddingId?: number;
    similarity: number;
    distance: number;
    qualityScore?: number | null;
    model?: string;
  };
  candidates?: Array<{
    personCode: string;
    firstName: string;
    lastName: string;
    similarity: number;
  }>;
}

export type FaceRecognitionDbClient = Pick<typeof prisma, "$queryRawUnsafe">;

/**
 * Executes native PostgreSQL + pgvector cosine similarity search (<=> operator)
 * to find top matching active face embeddings across DISTINCT registered people (person_id)
 * and classify recognition confidence.
 */
export async function findTopFaceMatches(
  embedding: number[],
  topN: number = 2,
  modelName: string = "buffalo_s",
  dbClient: FaceRecognitionDbClient = prisma
): Promise<RecognitionClassificationResult> {
  validateEmbeddingVector(embedding);

  const matchThreshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.50");
  const ambiguityMargin = parseFloat(process.env.FACE_AMBIGUITY_MARGIN || "0.05");

  // Format 512D float array into pgvector literal format: '[v1,v2,...,v512]'
  const vectorString = `[${embedding.join(",")}]`;

  // Query only active embeddings matching the exact model architecture,
  // selecting the single best (closest) embedding per distinct person_id
  // so multiple embeddings belonging to the same person never compete against each other.
  const rawResults: Array<{
    embeddingId: number;
    personId: number;
    embeddingModel: string;
    qualityScore: number | null;
    isActive: boolean;
    personCode: string;
    firstName: string;
    lastName: string;
    category: string;
    department: string | null;
    status: string;
    faceImageUrl: string | null;
    distance: number;
    similarity: number;
  }> = await dbClient.$queryRawUnsafe(
    `
    SELECT *
    FROM (
      SELECT DISTINCT ON (fe.person_id)
        fe.id AS "embeddingId",
        fe.person_id AS "personId",
        fe.embedding_model AS "embeddingModel",
        fe.quality_score AS "qualityScore",
        fe.is_active AS "isActive",
        p.person_code AS "personCode",
        p.first_name AS "firstName",
        p.last_name AS "lastName",
        p.category::text AS "category",
        p.department AS "department",
        p.status::text AS "status",
        p.face_image_url AS "faceImageUrl",
        (fe.embedding <=> $1::vector) AS distance,
        (1 - (fe.embedding <=> $1::vector)) AS similarity
      FROM face_embeddings fe
      JOIN persons p ON p.id = fe.person_id
      WHERE fe.is_active = true
        AND LOWER(fe.embedding_model) = LOWER($3)
      ORDER BY fe.person_id, (fe.embedding <=> $1::vector) ASC
    ) distinct_person_matches
    ORDER BY distance ASC
    LIMIT $2;
    `,
    vectorString,
    topN,
    modelName
  );

  if (!rawResults || rawResults.length === 0) {
    return {
      matchStatus: "unknown",
      person: null,
      face: {
        similarity: 0.0,
        distance: 1.0,
        model: modelName,
      },
    };
  }

  // Also deduplicate by personId in application code (preserving best similarity per person)
  // as defense-in-depth in case raw results contain multiple rows for the same personId.
  const sortedRaw = [...rawResults].sort(
    (a, b) => Number(b.similarity) - Number(a.similarity)
  );
  const distinctResults: typeof rawResults = [];
  const seenPersonIds = new Set<number>();
  for (const row of sortedRaw) {
    const pid = Number(row.personId);
    if (!seenPersonIds.has(pid)) {
      seenPersonIds.add(pid);
      distinctResults.push(row);
    }
  }

  const bestCandidate = distinctResults[0];
  const bestSimilarity = roundFloat(Number(bestCandidate.similarity), 4);
  const bestDistance = roundFloat(Number(bestCandidate.distance), 4);

  // Check if best match meets configured FACE_MATCH_THRESHOLD
  if (bestSimilarity < matchThreshold) {
    return {
      matchStatus: "unknown",
      person: null,
      face: {
        similarity: bestSimilarity,
        distance: bestDistance,
        qualityScore: bestCandidate.qualityScore != null ? roundFloat(Number(bestCandidate.qualityScore), 4) : null,
        model: bestCandidate.embeddingModel || modelName || "buffalo_s",
      },
    };
  }

  // If only 1 distinct person candidate exists and similarity >= matchThreshold -> MATCHED
  if (distinctResults.length === 1) {
    return {
      matchStatus: "matched",
      person: {
        id: Number(bestCandidate.personId),
        personCode: bestCandidate.personCode,
        firstName: bestCandidate.firstName,
        lastName: bestCandidate.lastName,
        category: String(bestCandidate.category),
        department: bestCandidate.department,
        status: String(bestCandidate.status),
        faceImageUrl: bestCandidate.faceImageUrl,
      },
      face: {
        embeddingId: Number(bestCandidate.embeddingId),
        similarity: bestSimilarity,
        distance: bestDistance,
        qualityScore: bestCandidate.qualityScore != null ? roundFloat(Number(bestCandidate.qualityScore), 4) : null,
        model: bestCandidate.embeddingModel || modelName || "buffalo_s",
      },
    };
  }

  // Multiple distinct person candidates exist: check ambiguity margin between top 2 distinct people
  const secondCandidate = distinctResults[1];
  const secondSimilarity = roundFloat(Number(secondCandidate.similarity), 4);
  const similarityMargin = roundFloat(bestSimilarity - secondSimilarity, 4);

  if (similarityMargin < ambiguityMargin) {
    // Two distinct registered people are too close in similarity -> AMBIGUOUS
    return {
      matchStatus: "ambiguous",
      person: null,
      face: {
        similarity: bestSimilarity,
        distance: bestDistance,
        qualityScore: bestCandidate.qualityScore != null ? roundFloat(Number(bestCandidate.qualityScore), 4) : null,
        model: bestCandidate.embeddingModel || modelName || "buffalo_s",
      },
      candidates: [
        {
          personCode: bestCandidate.personCode,
          firstName: bestCandidate.firstName,
          lastName: bestCandidate.lastName,
          similarity: bestSimilarity,
        },
        {
          personCode: secondCandidate.personCode,
          firstName: secondCandidate.firstName,
          lastName: secondCandidate.lastName,
          similarity: secondSimilarity,
        },
      ],
    };
  }

  // Clear winner -> MATCHED
  return {
    matchStatus: "matched",
    person: {
      id: Number(bestCandidate.personId),
      personCode: bestCandidate.personCode,
      firstName: bestCandidate.firstName,
      lastName: bestCandidate.lastName,
      category: String(bestCandidate.category),
      department: bestCandidate.department,
      status: String(bestCandidate.status),
      faceImageUrl: bestCandidate.faceImageUrl,
    },
    face: {
      embeddingId: Number(bestCandidate.embeddingId),
      similarity: bestSimilarity,
      distance: bestDistance,
      qualityScore: bestCandidate.qualityScore != null ? roundFloat(Number(bestCandidate.qualityScore), 4) : null,
      model: bestCandidate.embeddingModel || modelName || "buffalo_s",
    },
  };
}

function roundFloat(val: number, decimals: number): number {
  return Number(Math.fround(val).toFixed(decimals));
}
