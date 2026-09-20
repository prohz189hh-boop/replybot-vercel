import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { resolveDashboardContextForApi } from "@/lib/auth/context";
import { requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { enforceResourceLimit, UsageLimitError } from "@/lib/billing/entitlements";
import { sendTeamInvitationEmail } from "@/lib/email/templates";
import { logAudit } from "@/lib/security/audit";

const bodySchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(["ADMIN", "AGENT"]), // inviting as OWNER isn't allowed via this route
});

export async function POST(req: Request) {
  const ctx = await resolveDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    await requirePermission(ctx.business.id, "team.invite");
    await enforceResourceLimit(ctx.business.id, "team_members");

    const email = parsed.data.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId: ctx.business.id, userId: existingUser.id } },
      });
      if (existingMembership) {
        return NextResponse.json({ error: "This person is already on your team." }, { status: 400 });
      }
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const invitation = await prisma.teamInvitation.create({
      data: {
        businessId: ctx.business.id,
        email,
        role: parsed.data.role,
        tokenHash,
        invitedById: ctx.user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      },
    });

    await sendTeamInvitationEmail(email, rawToken, ctx.business.name, ctx.user.name ?? ctx.user.email).catch((err) => {
      console.error("Failed to send invitation email", err);
    });

    await logAudit({
      businessId: ctx.business.id,
      userId: ctx.user.id,
      action: "team.invited",
      metadata: { email, role: parsed.data.role },
    });

    return NextResponse.json({ invitation: { id: invitation.id, email, role: invitation.role } }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof UsageLimitError) {
      return NextResponse.json({ error: `You've reached your plan's team size limit (${err.limit}).` }, { status: 402 });
    }
    throw err;
  }
}
