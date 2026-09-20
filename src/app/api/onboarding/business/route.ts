import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/security/audit";

const bodySchema = z.object({ businessName: z.string().min(1).max(160) });

/**
 * Normal signup (POST /api/auth/signup) already creates a business
 * inline, so this only matters for the edge case of an authenticated
 * user with zero business memberships (e.g. a future account-creation
 * path that doesn't bundle business creation). Without this, such a
 * user would be redirected to /onboarding with no way to actually
 * finish it.
 */
export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const existingMembership = await prisma.businessMember.findFirst({ where: { userId: user.id } });
  if (existingMembership) {
    return NextResponse.json({ error: "You already belong to a business." }, { status: 400 });
  }

  const business = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({ data: { name: parsed.data.businessName } });
    await tx.businessMember.create({ data: { businessId: business.id, userId: user.id, role: "OWNER" } });
    await tx.subscription.create({ data: { businessId: business.id, plan: "FREE" } });
    return business;
  });

  await logAudit({ businessId: business.id, userId: user.id, action: "business.created_via_onboarding" });

  return NextResponse.json({ business }, { status: 201 });
}
