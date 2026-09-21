import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireResourceAccess, TenantAccessError } from "@/lib/tenant/guard";
import { runRagPipeline } from "@/lib/rag/pipeline";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

const bodySchema = z.object({ message: z.string().min(1).max(4000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { resource: agent, session } = await requireResourceAccess(
      () => prisma.agent.findUnique({ where: { id: params.id } }),
      (a) => a?.businessId,
      "AGENT",
    );

    // Same per-business AI-usage rate limit category as the public
    // widget uses, keyed by the staff user instead of a visitor — the
    // playground calls the real provider and should not be a free,
    // unlimited way around usage accounting.
    const rate = await checkRateLimit(`playground:${session.user.id}`, RATE_LIMITS.aiGeneration);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many test messages — slow down a moment." }, { status: 429 });
    }

    const result = await runRagPipeline({
      agent,
      conversationHistory: [],
      customerMessage: parsed.data.message,
    });

    // Include retrieved source snippets + confidence for the trust/QA
    // purpose the playground exists for — but never the system prompt
    // itself, per the spec's "don't expose sensitive system prompts."
    const chunks = result.retrievedChunkIds.length
      ? await prisma.knowledgeChunk.findMany({
          where: { id: { in: result.retrievedChunkIds }, businessId: agent.businessId },
          select: { id: true, content: true },
        })
      : [];

    return NextResponse.json({
      reply: result.answer,
      confidence: result.confidence,
      wouldEscalate: result.shouldEscalate,
      escalationReason: result.escalationReason ?? null,
      sources: chunks,
    });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.message.startsWith("No AI provider configured")) {
      return NextResponse.json({
        error: "The AI service isn't configured yet. Add GEMINI_API_KEY in Vercel Production, then redeploy to activate the playground.",
        code: "AI_NOT_CONFIGURED",
      }, { status: 503 });
    }
    console.error("[playground] AI request failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({
      error: "The AI service couldn't process this message. Check the AI provider configuration and try again.",
      code: "AI_REQUEST_FAILED",
    }, { status: 503 });
  }
}
