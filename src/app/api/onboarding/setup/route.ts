import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveDashboardContextForApi, setActiveBusinessCookie } from "@/lib/auth/context";
import { requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { enforceResourceLimit, UsageLimitError } from "@/lib/billing/entitlements";
import { indexKnowledgeSource } from "@/lib/rag/indexer";
import { crawlSinglePage } from "@/lib/crawler/crawler";
import { logAudit } from "@/lib/security/audit";
import { getSession } from "@/lib/auth/session";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("business"),
    name: z.string().trim().min(1).max(160),
    website: z.string().url().max(300).optional().or(z.literal("")),
    industry: z.string().trim().max(120).optional(),
    description: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("agent"),
    name: z.string().trim().min(1).max(120),
    personality: z.enum(["PROFESSIONAL", "FRIENDLY", "CONCISE", "DETAILED"]).default("FRIENDLY"),
    responseLength: z.enum(["SHORT", "BALANCED", "DETAILED"]).default("BALANCED"),
  }),
  z.object({
    action: z.literal("knowledge"),
    agentId: z.string().min(1),
    kind: z.enum(["TEXT", "WEBSITE"]),
    name: z.string().trim().min(1).max(160),
    content: z.string().max(50000).optional(),
    url: z.string().url().max(2000).optional(),
  }),
]);

export async function POST(req: Request) {
  const user = await requireUserForOnboarding();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    if (parsed.data.action === "business") {
      const existing = await prisma.businessMember.findFirst({ where: { userId: user.id } });
      if (existing) return NextResponse.json({ error: "You already belong to a business." }, { status: 409 });

      const business = await prisma.$transaction(async (tx) => {
        const created = await tx.business.create({
          data: {
            name: parsed.data.name,
            website: parsed.data.website || null,
            industry: parsed.data.industry || null,
            description: parsed.data.description || null,
          },
        });
        await tx.businessMember.create({ data: { businessId: created.id, userId: user.id, role: "OWNER" } });
        await tx.subscription.create({ data: { businessId: created.id, plan: "FREE" } });
        return created;
      });

      setActiveBusinessCookie(business.id);
      await logAudit({ businessId: business.id, userId: user.id, action: "onboarding.business.created" });
      return NextResponse.json({ business }, { status: 201 });
    }

    const ctx = await resolveDashboardContextForApi();
    if (!ctx) return NextResponse.json({ error: "Business setup required" }, { status: 400 });
    if (parsed.data.action === "agent") {
      await requirePermission(ctx.business.id, "agent.manage");
      await enforceResourceLimit(ctx.business.id, "agents");

      const agent = await prisma.agent.create({
        data: {
          businessId: ctx.business.id,
          name: parsed.data.name,
          personality: parsed.data.personality,
          responseLength: parsed.data.responseLength,
          widgetConfig: { create: {} },
        },
      });
      await logAudit({ businessId: ctx.business.id, userId: user.id, action: "onboarding.agent.created", metadata: { agentId: agent.id } });
      return NextResponse.json({ agent }, { status: 201 });
    }

    await requirePermission(ctx.business.id, "knowledge.manage");
    await enforceResourceLimit(ctx.business.id, "knowledge_sources");

    const agent = await prisma.agent.findFirst({
      where: { id: parsed.data.agentId, businessId: ctx.business.id },
      select: { id: true },
    });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    if (parsed.data.kind === "TEXT") {
      const content = parsed.data.content?.trim() ?? "";
      if (!content) return NextResponse.json({ error: "Knowledge content is required" }, { status: 400 });
      const source = await prisma.knowledgeSource.create({
        data: {
          businessId: ctx.business.id,
          agentId: agent.id,
          type: "MANUAL_TEXT",
          name: parsed.data.name,
          rawContent: content,
          status: "PROCESSING",
        },
      });
      try {
        await indexKnowledgeSource(source.id, content);
      } catch {
        // indexer persists the failure state
      }
      return NextResponse.json({ source }, { status: 201 });
    }

    if (!parsed.data.url) return NextResponse.json({ error: "Website URL is required" }, { status: 400 });
    const source = await prisma.knowledgeSource.create({
      data: {
        businessId: ctx.business.id,
        agentId: agent.id,
        type: "WEBSITE",
        name: parsed.data.name,
        sourceUrl: parsed.data.url,
        status: "PROCESSING",
      },
    });
    try {
      const page = await crawlSinglePage(parsed.data.url);
      await indexKnowledgeSource(source.id, page.text);
    } catch (err) {
      await prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Website indexing failed" },
      });
    }
    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof UsageLimitError) return NextResponse.json({ error: `You've reached your plan limit (${err.limit}).` }, { status: 402 });
    throw err;
  }
}

async function requireUserForOnboarding() {
  const ctx = await getSession();
  return ctx?.user ?? null;
}
