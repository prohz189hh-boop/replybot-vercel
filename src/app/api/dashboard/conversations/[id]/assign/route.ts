import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireResourceAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { logAudit } from "@/lib/security/audit";

const bodySchema = z.object({ memberId: z.string().min(1).nullable() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { resource: conversation, session } = await requireResourceAccess(
      () => prisma.conversation.findUnique({ where: { id: params.id } }),
      (c) => c?.businessId,
      "AGENT",
    );
    await requirePermission(conversation.businessId, "conversation.assign");

    if (parsed.data.memberId) {
      // The assignee must be a real member of THIS business — never
      // trust a memberId from the client without checking it belongs to
      // the same tenant as the conversation being assigned.
      const targetMember = await prisma.businessMember.findFirst({
        where: { id: parsed.data.memberId, businessId: conversation.businessId },
      });
      if (!targetMember) {
        return NextResponse.json({ error: "That person isn't a member of this business." }, { status: 400 });
      }
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedToId: parsed.data.memberId },
    });

    await logAudit({
      businessId: conversation.businessId,
      userId: session.user.id,
      action: "conversation.assigned",
      metadata: { conversationId: conversation.id, memberId: parsed.data.memberId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
