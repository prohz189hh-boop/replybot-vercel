import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireResourceAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

const bodySchema = z.object({ content: z.string().min(1).max(4000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { resource: conversation, session, membership } = await requireResourceAccess(
      () => prisma.conversation.findUnique({ where: { id: params.id } }),
      (c) => c?.businessId,
      "AGENT",
    );
    await requirePermission(conversation.businessId, "conversation.reply");

    const rate = await checkRateLimit(`human-reply:${session.user.id}`, RATE_LIMITS.aiGeneration);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "HUMAN",
        content: parsed.data.content,
        authorMemberId: membership.id,
      },
    });

    // A human reply means a human is now handling this conversation —
    // the AI must not respond to the customer's next message until
    // someone explicitly returns it to AI (see the status route).
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "HUMAN", assignedToId: conversation.assignedToId ?? membership.id },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
