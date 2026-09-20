import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveDashboardContextForApi } from "@/lib/auth/context";
import { requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { logAudit } from "@/lib/security/audit";

const bodySchema = z.object({ role: z.enum(["OWNER", "ADMIN", "AGENT"]) });

async function loadMember(businessId: string, memberId: string) {
  return prisma.businessMember.findFirst({ where: { id: memberId, businessId } });
}

export async function PATCH(req: Request, { params }: { params: { memberId: string } }) {
  const ctx = await resolveDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    // Only an OWNER can promote/demote OWNER or ADMIN roles.
    await requirePermission(ctx.business.id, "team.manageOwnersAdmins");

    const member = await loadMember(ctx.business.id, params.memberId);
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (member.role === "OWNER" && parsed.data.role !== "OWNER") {
      const ownerCount = await prisma.businessMember.count({ where: { businessId: ctx.business.id, role: "OWNER" } });
      if (ownerCount <= 1) {
        return NextResponse.json({ error: "A business must have at least one owner." }, { status: 400 });
      }
    }

    await prisma.businessMember.update({ where: { id: member.id }, data: { role: parsed.data.role } });

    await logAudit({
      businessId: ctx.business.id,
      userId: ctx.user.id,
      action: "team.role_changed",
      metadata: { memberId: member.id, newRole: parsed.data.role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: { memberId: string } }) {
  const ctx = await resolveDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await requirePermission(ctx.business.id, "team.removeMember");

    const member = await loadMember(ctx.business.id, params.memberId);
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (member.role === "OWNER") {
      const ownerCount = await prisma.businessMember.count({ where: { businessId: ctx.business.id, role: "OWNER" } });
      if (ownerCount <= 1) {
        return NextResponse.json({ error: "A business must have at least one owner." }, { status: 400 });
      }
    }

    // An ADMIN can remove AGENTs but not other ADMINs/OWNERs — that
    // finer-grained check isn't expressible as a single permission
    // threshold, so it's enforced here explicitly.
    if (ctx.role === "ADMIN" && member.role !== "AGENT") {
      return NextResponse.json({ error: "Admins can only remove agents." }, { status: 403 });
    }

    await prisma.businessMember.delete({ where: { id: member.id } });

    await logAudit({
      businessId: ctx.business.id,
      userId: ctx.user.id,
      action: "team.member_removed",
      metadata: { memberId: member.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
