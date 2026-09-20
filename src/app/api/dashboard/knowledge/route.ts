import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBusinessAccess, requireResourceAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { enforceResourceLimit, UsageLimitError } from "@/lib/billing/entitlements";
import { indexKnowledgeSource } from "@/lib/rag/indexer";
import { crawlSinglePage } from "@/lib/crawler/crawler";
import { validateUpload, verifyFileSignature, getStorage } from "@/lib/storage/storage";
import { extractTextFromFile } from "@/lib/knowledge/extract-text";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/security/audit";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

  try {
    const { resource: agent } = await requireResourceAccess(
      () => prisma.agent.findUnique({ where: { id: agentId } }),
      (a) => a?.businessId,
      "AGENT",
    );

    const sources = await prisma.knowledgeSource.findMany({
      where: { businessId: agent.businessId, agentId: agent.id }, // both scoped — agentId alone isn't enough
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ sources });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

const textSourceSchema = z.object({
  agentId: z.string().min(1),
  type: z.enum(["MANUAL_TEXT", "FAQ"]),
  name: z.string().min(1).max(160),
  content: z.string().min(1).max(50000),
});

const websiteSourceSchema = z.object({
  agentId: z.string().min(1),
  type: z.literal("WEBSITE"),
  name: z.string().min(1).max(160),
  url: z.string().url().max(2000),
});

/**
 * Text/FAQ/website sources come as JSON; file uploads come as
 * multipart/form-data (see the `FILE` branch below) — this route
 * branches on Content-Type rather than splitting into two endpoints,
 * since they share every check up through "does this agent belong to
 * the caller's business."
 */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handleFileUpload(req);
  }

  const raw = await req.json().catch(() => null);
  const websiteParsed = websiteSourceSchema.safeParse(raw);
  const textParsed = websiteParsed.success ? null : textSourceSchema.safeParse(raw);

  if (!websiteParsed.success && !textParsed?.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const input = (websiteParsed.success ? websiteParsed.data : textParsed!.data) as
    | z.infer<typeof websiteSourceSchema>
    | z.infer<typeof textSourceSchema>;

  try {
    const { resource: agent, session } = await requireResourceAccess(
      () => prisma.agent.findUnique({ where: { id: input.agentId } }),
      (a) => a?.businessId,
      "AGENT",
    );
    await requirePermission(agent.businessId, "knowledge.manage");
    await enforceResourceLimit(agent.businessId, "knowledge_sources");

    if (input.type === "WEBSITE") {
      const rate = await checkRateLimit(`crawl:${agent.businessId}`, RATE_LIMITS.crawling);
      if (!rate.allowed) {
        return NextResponse.json({ error: "Too many crawl requests. Try again in a minute." }, { status: 429 });
      }

      const source = await prisma.knowledgeSource.create({
        data: {
          businessId: agent.businessId,
          agentId: agent.id,
          type: "WEBSITE",
          name: input.name,
          sourceUrl: input.url,
          status: "PROCESSING",
        },
      });

      // No background job queue exists yet (see README) — this runs
      // synchronously within the request. Fine for a single page; a
      // slow/unreachable site will make this request slow. Errors are
      // caught and written to the source's status rather than failing
      // the whole request, so the dashboard can show what went wrong.
      try {
        const page = await crawlSinglePage(input.url);
        await indexKnowledgeSource(source.id, page.text);
      } catch (err) {
        await prisma.knowledgeSource.update({
          where: { id: source.id },
          data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Crawl failed" },
        });
      }

      await logAudit({
        businessId: agent.businessId,
        userId: session.user.id,
        action: "knowledge.created",
        metadata: { sourceId: source.id, type: "WEBSITE" },
      });

      return NextResponse.json({ source }, { status: 201 });
    }

    // MANUAL_TEXT / FAQ
    const source = await prisma.knowledgeSource.create({
      data: {
        businessId: agent.businessId,
        agentId: agent.id,
        type: input.type,
        name: input.name,
        rawContent: input.content,
        status: "PROCESSING",
      },
    });

    try {
      await indexKnowledgeSource(source.id, input.content);
    } catch {
      // indexKnowledgeSource already writes FAILED + errorMessage itself
    }

    await logAudit({
      businessId: agent.businessId,
      userId: session.user.id,
      action: "knowledge.created",
      metadata: { sourceId: source.id, type: input.type },
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof UsageLimitError) {
      return NextResponse.json({ error: `You've reached your plan's knowledge source limit (${err.limit}).` }, { status: 402 });
    }
    throw err;
  }
}

async function handleFileUpload(req: Request): Promise<NextResponse> {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const agentId = form.get("agentId");
  const name = form.get("name");
  const file = form.get("file");

  if (typeof agentId !== "string" || typeof name !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "agentId, name, and file are required" }, { status: 400 });
  }

  try {
    const { resource: agent, session } = await requireResourceAccess(
      () => prisma.agent.findUnique({ where: { id: agentId } }),
      (a) => a?.businessId,
      "AGENT",
    );
    await requirePermission(agent.businessId, "knowledge.manage");
    await enforceResourceLimit(agent.businessId, "knowledge_sources");

    const rate = await checkRateLimit(`upload:${agent.businessId}`, RATE_LIMITS.uploads);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many uploads. Try again in a minute." }, { status: 429 });
    }

    validateUpload({ size: file.size, type: file.type, name: file.name });

    const buffer = Buffer.from(await file.arrayBuffer());
    verifyFileSignature(buffer, file.type); // real content check, not just the declared type

    const source = await prisma.knowledgeSource.create({
      data: {
        businessId: agent.businessId,
        agentId: agent.id,
        type: "FILE",
        name: name || file.name,
        status: "PROCESSING",
      },
    });

    try {
      const storage = getStorage();
      const key = `knowledge/${agent.businessId}/${source.id}/${file.name}`;
      const filePath = await storage.put(key, buffer, file.type);
      await prisma.knowledgeSource.update({ where: { id: source.id }, data: { filePath } });

      const text = await extractTextFromFile(buffer, file.type);
      await indexKnowledgeSource(source.id, text);
    } catch (err) {
      await prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "File processing failed" },
      });
    }

    await logAudit({
      businessId: agent.businessId,
      userId: session.user.id,
      action: "knowledge.created",
      metadata: { sourceId: source.id, type: "FILE" },
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof UsageLimitError) {
      return NextResponse.json({ error: `You've reached your plan's knowledge source limit (${err.limit}).` }, { status: 402 });
    }
    if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
