import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession, getSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/security/audit";

async function loadInvitation(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return prisma.teamInvitation.findUnique({ where: { tokenHash } });
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const invitation = await loadInvitation(params.token);
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 400 });
  }
  const business = await prisma.business.findUnique({ where: { id: invitation.businessId }, select: { name: true } });
  return NextResponse.json({ email: invitation.email, role: invitation.role, businessName: business?.name });
}

// If the person accepting is already logged in as the invited email,
// no password is needed. Otherwise (new person), a password creates
// their account as part of accepting.
const bodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8).max(200).optional(),
});

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const invitation = await loadInvitation(params.token);
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const session = await getSession();
  let userId: string;

  if (session?.user && session.user.email === invitation.email) {
    userId = session.user.id;
  } else {
    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      // Existing account for this email, but not logged in as them —
      // require login rather than silently attaching the invitation to
      // whoever happens to submit this form.
      return NextResponse.json({ error: "An account already exists for this email. Please log in first." }, { status: 400 });
    }

    if (!parsed.data.name || !parsed.data.password) {
      return NextResponse.json({ error: "Name and password are required to create your account." }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: { email: invitation.email, name: parsed.data.name, passwordHash, emailVerified: new Date() }, // invitation email is pre-verified by definition
    });
    userId = user.id;
    await createSession(userId);
  }

  await prisma.$transaction([
    prisma.businessMember.create({ data: { businessId: invitation.businessId, userId, role: invitation.role } }),
    prisma.teamInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
  ]);

  await logAudit({ businessId: invitation.businessId, userId, action: "team.invitation_accepted" });

  return NextResponse.json({ ok: true });
}
