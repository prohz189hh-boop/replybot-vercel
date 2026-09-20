import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireResourceAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";

async function loadConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: true,
      agent: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { resource: conversation } = await requireResourceAccess(
      () => loadConversation(params.id),
      (c) => c?.businessId,
      "AGENT",
    );
    await requirePermission(conversation.businessId, "conversation.view");

    // Opening a conversation is when a human has "seen" it — clear the
    // unread count the dashboard was showing.
    if (conversation.unreadCount > 0) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { unreadCount: 0 } });
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
