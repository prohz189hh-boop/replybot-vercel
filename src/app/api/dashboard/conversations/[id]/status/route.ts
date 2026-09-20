import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireResourceAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { logAudit } from "@/lib/security/audit";

const bodySchema = z.object({
  status: z.enum(["AI", "HUMAN", "WAITING_FOR_HUMAN", "RESOLVED", "OPEN"]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { resource: conversation, session, membership } = await requireResourceAccess(
      () => prisma.conversation.findUnique({ where: { id: params.id } }),
      (c) => c?.businessId,
      "AGENT",
    );
    await requirePermission(conversation.businessId, "conversation.status");

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: parsed.data.status,
        // Taking over (HUMAN) auto-assigns to whoever did it, if
        // nobody's assigned yet — same convenience as replying does.
        assignedToId:
          parsed.data.status === "HUMAN" ? conversation.assignedToId ?? membership.id : conversation.assignedToId,
      },
    });

    await logAudit({
      businessId: conversation.businessId,
      userId: session.user.id,
      action: "conversation.status_changed",
      metadata: { conversationId: conversation.id, status: parsed.data.status },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
