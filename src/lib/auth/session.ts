import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "replypilot_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token: string) {
  // The raw token lives only in the client's cookie; we store just the
  // hash, so a DB read alone never yields a usable session token.
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt },
  });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: hashToken(token) } }).catch(() => {});
  }
  cookies().delete(SESSION_COOKIE);
}

export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

/**
 * Deletes expired session rows. getSession() already refuses to
 * authenticate an expired session (belt-and-suspenders: correctness
 * doesn't depend on this running), but without periodic cleanup the
 * Session table grows unbounded. Wire this into a scheduled job/cron
 * (e.g. daily) — it does not run automatically on every request.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

/** Use in server actions/route handlers that require a logged-in user. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    const err = new Error("Not authenticated") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return session.user;
}
