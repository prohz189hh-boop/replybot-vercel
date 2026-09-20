import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { checkRateLimit, getTrustedClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/templates";

const bodySchema = z.object({ email: z.string().email().max(255) });

// Always the same message, whether or not the email exists — this
// route's whole job is to not leak which emails are registered.
const GENERIC_MESSAGE = "If an account exists for that email, we've sent a reset link.";

export async function POST(req: Request) {
  const ip = getTrustedClientIp(req);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: GENERIC_MESSAGE });

  const rate = await checkRateLimit(`password-reset:${ip}:${parsed.data.email.toLowerCase()}`, RATE_LIMITS.passwordReset);
  if (!rate.allowed) {
    // Even the rate-limit response stays generic in shape/status so it
    // doesn't distinguish "you're being throttled" from "sent" in a way
    // that helps enumerate accounts; callers just see the same message.
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 1000 * 60 * 60) },
    });
    await sendPasswordResetEmail(user.email, rawToken).catch((err) => {
      console.error("Failed to send password reset email", err);
    });
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
