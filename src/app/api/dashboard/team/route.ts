import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveDashboardContextForApi } from "@/lib/auth/context";
import { requirePermission, TenantAccessError } from "@/lib/tenant/guard";

export async function GET() {
  const ctx = await resolveDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    // Any member can see the team list (not just admins) — it's not
    // sensitive, and agents benefit from knowing who else is around to
    // assign conversations to.
    await requirePermission(ctx.business.id, "conversation.view");

    const [members, invitations] = await Promise.all([
      prisma.businessMember.findMany({
        where: { businessId: ctx.business.id },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.teamInvitation.findMany({
        where: { businessId: ctx.business.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      members: members.map((m) => ({ id: m.id, role: m.role, user: m.user })),
      invitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt })),
      currentMembershipId: ctx.membershipId,
    });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
