import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/security/audit";

const bodySchema = z.object({
  token: z.string().min(1).max(500),
  newPassword: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Resetting a password invalidates every existing session — if
    // someone else had access to the account, this cuts them off too.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  await logAudit({ userId: record.userId, action: "user.password_reset" });

  return NextResponse.json({ ok: true });
}
