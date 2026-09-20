import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireResourceAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";

const bodySchema = z.object({ content: z.string().min(1).max(2000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { resource: conversation, membership } = await requireResourceAccess(
      () => prisma.conversation.findUnique({ where: { id: params.id } }),
      (c) => c?.businessId,
      "AGENT",
    );
    await requirePermission(conversation.businessId, "conversation.note");

    // Internal notes are staff-only — never returned by the public chat
    // API or shown to the customer anywhere.
    const note = await prisma.internalNote.create({
      data: { conversationId: conversation.id, content: parsed.data.content, authorMemberId: membership.id },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
