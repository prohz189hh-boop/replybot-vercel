import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";

const CHUNK_SIZE_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 150;

export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE_CHARS, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return chunks;
}

/**
 * Indexes a KnowledgeSource: chunks its content, embeds each chunk, and
 * writes KnowledgeChunk rows. Always stamps businessId from the parent
 * source (never from caller input) to keep vector search tenant-scoped.
 */
export async function indexKnowledgeSource(knowledgeSourceId: string, content: string) {
  const source = await prisma.knowledgeSource.update({
    where: { id: knowledgeSourceId },
    data: { status: "PROCESSING" },
  });

  try {
    const chunks = chunkText(content);
    if (!chunks.length) {
      throw new Error("No extractable content");
    }

    const ai = getAIProvider();
    const embeddings = await ai.embed(chunks);

    await prisma.knowledgeChunk.deleteMany({ where: { knowledgeSourceId } });

    // Written via raw SQL because Prisma's client can't yet bind a
    // pgvector literal through the normal `create` API.
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      if (!chunk || !embedding) {
        throw new Error(`Missing chunk or embedding at index ${i}`);
      }
      const vectorLiteral = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk" (id, "knowledgeSourceId", "businessId", content, embedding, "tokenCount", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector, $5, now())`,
        knowledgeSourceId,
        source.businessId,
        chunk,
        vectorLiteral,
        Math.ceil(chunk.length / 4),
      );
    }

    await prisma.knowledgeSource.update({
      where: { id: knowledgeSourceId },
      data: {
        status: "READY",
        chunkCount: chunks.length,
        lastIndexedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.knowledgeSource.update({
      where: { id: knowledgeSourceId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown indexing error",
      },
    });
    throw err;
  }
}
