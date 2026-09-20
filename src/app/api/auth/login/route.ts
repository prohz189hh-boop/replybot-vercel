import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, getTrustedClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/security/audit";

const bodySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

const GENERIC_ERROR = "Incorrect email or password.";

export async function POST(req: Request) {
  const ip = getTrustedClientIp(req);
  // Rate-limit by IP AND by the submitted email, so an attacker can't
  // spread a credential-stuffing attempt across many emails from one IP
  // (blocked by the IP limit) or hammer one email from many IPs
  // (blocked by the email limit) — either alone is bypassable.
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(`login:ip:${ip}`, RATE_LIMITS.login),
    checkRateLimit(`login:email:${email.toLowerCase()}`, RATE_LIMITS.login),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Always run a hash verification, even when no user exists, using a
  // fixed dummy hash — otherwise "unknown email" responds faster than
  // "wrong password," and that timing difference lets an attacker
  // enumerate registered emails.
  const DUMMY_HASH = "scrypt$32768$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const validPassword = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);

  if (!user || !validPassword) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await createSession(user.id);
  await logAudit({ userId: user.id, action: "user.login" });

  return NextResponse.json({ ok: true });
}
