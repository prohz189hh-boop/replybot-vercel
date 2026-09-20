import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, getTrustedClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/security/audit";
import { sendVerificationEmail } from "@/lib/email/templates";

const bodySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
  businessName: z.string().min(1).max(160),
});

export async function POST(req: Request) {
  const ip = getTrustedClientIp(req);
  const rate = await checkRateLimit(`signup:${ip}`, RATE_LIMITS.signup);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  const { email, password, name, businessName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    // Same message as an unrelated validation failure — don't confirm
    // an email is registered to an unauthenticated caller.
    return NextResponse.json({ error: "Could not create your account. Please check the form and try again." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const { user, business } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: email.toLowerCase(), passwordHash, name },
    });
    const business = await tx.business.create({ data: { name: businessName } });
    await tx.businessMember.create({ data: { businessId: business.id, userId: user.id, role: "OWNER" } });
    await tx.subscription.create({ data: { businessId: business.id, plan: "FREE" } });
    return { user, business };
  });

  await createSession(user.id);
  await logAudit({ businessId: business.id, userId: user.id, action: "user.signup" });

  // Best-effort — a failed verification email shouldn't block account
  // creation (the console fallback logs it either way for dev/testing).
  try {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) },
    });
    await sendVerificationEmail(user.email, rawToken);
  } catch (err) {
    console.error("Failed to send verification email", err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
