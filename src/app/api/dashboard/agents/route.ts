import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBusinessAccess, TenantAccessError } from "@/lib/tenant/guard";
import { logAudit } from "@/lib/security/audit";
import { enforceResourceLimit } from "@/lib/billing/entitlements";

const createAgentSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(120),
});

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  try {
    await requireBusinessAccess(businessId, "AGENT");

    // businessId is always the server-resolved, access-checked one —
    // never interpolated from anywhere else in the request.
    const agents = await prisma.agent.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ agents });
  } catch (err) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const parsed = createAgentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { businessId, name } = parsed.data;

  try {
    const { session } = await requireBusinessAccess(businessId, "ADMIN");
    await enforceResourceLimit(businessId, "agents");

    const agent = await prisma.agent.create({
      data: {
        businessId,
        name,
        widgetConfig: { create: {} }, // defaults
      },
    });

    await logAudit({
      businessId,
      userId: session.user.id,
      action: "agent.created",
      metadata: { agentId: agent.id, name },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
