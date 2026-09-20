import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveDashboardContextForApi } from "@/lib/auth/context";
import { requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { logAudit } from "@/lib/security/audit";

/**
 * Client components need to know which business they're acting as
 * before POSTing anything, but the active business is resolved
 * server-side from session + cookie (see src/lib/auth/context.ts) —
 * never something the client should choose itself. This just exposes
 * that same resolution as JSON. Every route this id gets sent to still
 * re-validates it independently via requireBusinessAccess; this
 * endpoint is a convenience for the client, not a trust boundary.
 */
export async function GET() {
  const ctx = await resolveDashboardContextForApi();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({
    business: ctx.business,
    role: ctx.role,
    businesses: ctx.memberships.map((m) => ({ id: m.business.id, name: m.business.name, role: m.role })),
  });
}

const updateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  website: z.string().url().max(300).optional().or(z.literal("")),
  industry: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  contactEmail: z.string().email().max(255).optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
});

export async function PATCH(req: Request) {
  const ctx = await resolveDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    await requirePermission(ctx.business.id, "settings.manage");

    const business = await prisma.business.update({
      where: { id: ctx.business.id }, // already resolved from the caller's own membership, never client input
      data: parsed.data,
    });

    await logAudit({
      businessId: ctx.business.id,
      userId: ctx.user.id,
      action: "business.updated",
      metadata: { fields: Object.keys(parsed.data) },
    });

    return NextResponse.json({ business });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
