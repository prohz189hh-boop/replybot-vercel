import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveDashboardContextForApi } from "@/lib/auth/context";
import { requirePermission, TenantAccessError } from "@/lib/tenant/guard";

const PAGE_SIZE = 30;

export async function GET(req: Request) {
  const ctx = await resolveDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await requirePermission(ctx.business.id, "conversation.view");
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "all"; // all | ai | needs_human | mine | resolved
  const search = url.searchParams.get("search")?.trim();
  const cursor = url.searchParams.get("cursor");

  const where: Record<string, unknown> = { businessId: ctx.business.id };

  if (filter === "ai") where.status = "AI";
  else if (filter === "needs_human") where.status = { in: ["WAITING_FOR_HUMAN", "HUMAN"] };
  else if (filter === "resolved") where.status = "RESOLVED";
  else if (filter === "mine") where.assignedToId = ctx.membershipId;

  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
      { messages: { some: { content: { contains: search, mode: "insensitive" } } } },
    ];
  }

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      customer: { select: { name: true, email: true, externalId: true } },
      agent: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const hasMore = conversations.length > PAGE_SIZE;
  const page = hasMore ? conversations.slice(0, PAGE_SIZE) : conversations;

  return NextResponse.json({
    conversations: page.map((c) => ({
      id: c.id,
      status: c.status,
      unreadCount: c.unreadCount,
      updatedAt: c.updatedAt,
      customerName: c.customer.name ?? c.customer.email ?? `Visitor ${c.customer.externalId.slice(0, 8)}`,
      agentName: c.agent.name,
      lastMessage: c.messages[0]?.content ?? null,
      assignedToId: c.assignedToId,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
