import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireResourceAccess, TenantAccessError } from "@/lib/tenant/guard";
import { requirePermission } from "@/lib/tenant/guard";
import { logAudit } from "@/lib/security/audit";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  personality: z.enum(["PROFESSIONAL", "FRIENDLY", "CONCISE", "DETAILED"]).optional(),
  responseLength: z.enum(["SHORT", "BALANCED", "DETAILED"]).optional(),
  languages: z.array(z.string().min(1).max(10)).max(10).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  fallbackMessage: z.string().min(1).max(1000).optional(),
  escalationKeywords: z.array(z.string().min(1).max(60)).max(30).optional(),
  allowedDomains: z.array(z.string().url().max(200)).max(20).optional(),
  isActive: z.boolean().optional(),
  widgetConfig: z
    .object({
      welcomeMessage: z.string().min(1).max(300).optional(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      position: z.enum(["bottom-right", "bottom-left"]).optional(),
      chatButtonText: z.string().min(1).max(60).optional(),
      theme: z.enum(["light", "dark", "auto"]).optional(),
      humanHandoffMessage: z.string().min(1).max(300).optional(),
      logoUrl: z.string().url().max(500).optional(),
      avatarUrl: z.string().url().max(500).optional(),
    })
    .optional(),
});

async function loadAgent(id: string) {
  return prisma.agent.findUnique({ where: { id }, include: { widgetConfig: true } });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { resource: agent } = await requireResourceAccess(
      () => loadAgent(params.id),
      (a) => a?.businessId,
      "AGENT",
    );
    return NextResponse.json({ agent });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { resource: agent, session } = await requireResourceAccess(
      () => loadAgent(params.id),
      (a) => a?.businessId,
      "AGENT",
    );
    await requirePermission(agent.businessId, "agent.manage");

    const { widgetConfig, ...agentFields } = parsed.data;

    const updated = await prisma.agent.update({
      where: { id: agent.id }, // scoped resource already confirmed to belong to this business above
      data: {
        ...agentFields,
        widgetConfig: widgetConfig ? { update: widgetConfig } : undefined,
      },
      include: { widgetConfig: true },
    });

    await logAudit({
      businessId: agent.businessId,
      userId: session.user.id,
      action: "agent.updated",
      metadata: { agentId: agent.id, fields: Object.keys(parsed.data) },
    });

    return NextResponse.json({ agent: updated });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { resource: agent, session } = await requireResourceAccess(
      () => loadAgent(params.id),
      (a) => a?.businessId,
      "AGENT",
    );
    await requirePermission(agent.businessId, "agent.manage");

    // Soft-delete: an agent with live conversation/message history
    // shouldn't disappear (breaks the dashboard's own conversation
    // views and analytics), so deactivate rather than hard-delete.
    // isActive=false also immediately stops the public widget/chat API
    // from serving it.
    await prisma.agent.update({ where: { id: agent.id }, data: { isActive: false } });

    await logAudit({
      businessId: agent.businessId,
      userId: session.user.id,
      action: "agent.deactivated",
      metadata: { agentId: agent.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
