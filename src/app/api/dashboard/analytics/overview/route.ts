import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveDashboardContextForApi } from "@/lib/auth/context";
import { requirePermission, TenantAccessError } from "@/lib/tenant/guard";

const RANGE_DAYS: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

export async function GET(req: Request) {
  const ctx = await resolveDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await requirePermission(ctx.business.id, "analytics.view");
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "30";
  const days = RANGE_DAYS[rangeParam] ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalConversations,
    aiConversations,
    humanConversations,
    resolvedConversations,
    escalatedConversations,
    messageStats,
    dailyRows,
    topSources,
    recentUnanswered,
  ] = await Promise.all([
    prisma.conversation.count({ where: { businessId: ctx.business.id, createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { businessId: ctx.business.id, status: "AI", createdAt: { gte: since } } }),
    prisma.conversation.count({
      where: { businessId: ctx.business.id, status: { in: ["HUMAN", "WAITING_FOR_HUMAN"] }, createdAt: { gte: since } },
    }),
    prisma.conversation.count({ where: { businessId: ctx.business.id, status: "RESOLVED", createdAt: { gte: since } } }),
    prisma.unansweredQuestion.count({ where: { businessId: ctx.business.id, createdAt: { gte: since } } }),
    prisma.message.aggregate({
      where: { conversation: { businessId: ctx.business.id }, createdAt: { gte: since } },
      _count: true,
    }),
    // Parameterized raw query for the one thing Prisma's query builder
    // can't express (GROUP BY date truncation) — values are bound
    // params, never string-concatenated.
    prisma.$queryRawUnsafe<Array<{ day: string; count: bigint }>>(
      `
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
      FROM "Conversation"
      WHERE "businessId" = $1 AND "createdAt" >= $2
      GROUP BY 1 ORDER BY 1 ASC
      `,
      ctx.business.id,
      since,
    ),
    prisma.knowledgeSource.findMany({
      where: { businessId: ctx.business.id, status: "READY" },
      orderBy: { chunkCount: "desc" },
      take: 5,
      select: { id: true, name: true, type: true, chunkCount: true },
    }),
    prisma.unansweredQuestion.findMany({
      where: { businessId: ctx.business.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { question: true, reason: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    range: days,
    totals: {
      conversations: totalConversations,
      ai: aiConversations,
      human: humanConversations,
      resolved: resolvedConversations,
      escalated: escalatedConversations,
      messages: messageStats._count,
      resolutionRate: totalConversations > 0 ? Math.round((resolvedConversations / totalConversations) * 100) : null,
      aiResolutionRate: totalConversations > 0 ? Math.round((aiConversations / totalConversations) * 100) : null,
    },
    daily: dailyRows.map((r) => ({ day: r.day, count: Number(r.count) })),
    knowledgeSourceUsage: topSources,
    recentUnanswered,
  });
}
