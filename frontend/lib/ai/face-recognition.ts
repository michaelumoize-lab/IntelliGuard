import "dotenv/config";
import { prisma } from "@/lib/prisma";

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

/**
 * Executes native PostgreSQL + pgvector cosine similarity search (<=> operator)
 * to find top matching active face embeddings and classify recognition confidence.
 */
export async function findTopFaceMatches(
  embedding: number[],
  topN: number = 2
): Promise<RecognitionClassificationResult> {
  if (!embedding || embedding.length !== 512) {
    throw new Error("Invalid embedding vector: expected 512 dimensions.");
  }

  const matchThreshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.50");
  const ambiguityMargin = parseFloat(process.env.FACE_AMBIGUITY_MARGIN || "0.05");

  // Format 512D float array into pgvector literal format: '[v1,v2,...,v512]'
  const vectorString = `[${embedding.join(",")}]`;

  // Query only active embeddings belonging to active persons
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
    distance: number;
    similarity: number;
  }> = await prisma.$queryRawUnsafe(
    `
    SELECT 
      fe.id AS "embeddingId",
      fe.person_id AS "personId",
      fe.embedding_model AS "embeddingModel",
      fe.quality_score AS "qualityScore",
      fe.is_active AS "isActive",
      p.person_code AS "personCode",
      p.first_name AS "firstName",
      p.last_name AS "lastName",
      p.category AS "category",
      p.department AS "department",
      p.status AS "status",
      (fe.embedding <=> $1::vector) AS distance,
      (1 - (fe.embedding <=> $1::vector)) AS similarity
    FROM face_embeddings fe
    JOIN persons p ON p.id = fe.person_id
    WHERE fe.is_active = true AND p.status = 'active'
    ORDER BY fe.embedding <=> $1::vector ASC
    LIMIT $2;
    `,
    vectorString,
    topN
  );

  if (!rawResults || rawResults.length === 0) {
    return {
      matchStatus: "unknown",
      person: null,
      face: {
        similarity: 0.0,
        distance: 1.0,
      },
    };
  }

  const bestCandidate = rawResults[0];
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
        model: bestCandidate.embeddingModel || "buffalo_l",
      },
    };
  }

  // If only 1 candidate exists and similarity >= matchThreshold -> MATCHED
  if (rawResults.length === 1) {
    return {
      matchStatus: "matched",
      person: {
        id: Number(bestCandidate.personId),
        personCode: bestCandidate.personCode,
        firstName: bestCandidate.firstName,
        lastName: bestCandidate.lastName,
        category: bestCandidate.category,
        department: bestCandidate.department,
        status: bestCandidate.status,
      },
      face: {
        embeddingId: Number(bestCandidate.embeddingId),
        similarity: bestSimilarity,
        distance: bestDistance,
        qualityScore: bestCandidate.qualityScore != null ? roundFloat(Number(bestCandidate.qualityScore), 4) : null,
        model: bestCandidate.embeddingModel || "buffalo_l",
      },
    };
  }

  // Multiple candidates exist: check ambiguity margin
  const secondCandidate = rawResults[1];
  const secondSimilarity = roundFloat(Number(secondCandidate.similarity), 4);
  const similarityMargin = roundFloat(bestSimilarity - secondSimilarity, 4);

  if (similarityMargin < ambiguityMargin) {
    // Candidates are too close -> AMBIGUOUS
    return {
      matchStatus: "ambiguous",
      person: null,
      face: {
        similarity: bestSimilarity,
        distance: bestDistance,
        qualityScore: bestCandidate.qualityScore != null ? roundFloat(Number(bestCandidate.qualityScore), 4) : null,
        model: bestCandidate.embeddingModel || "buffalo_l",
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
      category: bestCandidate.category,
      department: bestCandidate.department,
      status: bestCandidate.status,
    },
    face: {
      embeddingId: Number(bestCandidate.embeddingId),
      similarity: bestSimilarity,
      distance: bestDistance,
      qualityScore: bestCandidate.qualityScore != null ? roundFloat(Number(bestCandidate.qualityScore), 4) : null,
      model: bestCandidate.embeddingModel || "buffalo_l",
    },
  };
}

function roundFloat(val: number, decimals: number): number {
  return Number(Math.fround(val).toFixed(decimals));
}
