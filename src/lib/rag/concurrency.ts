import { prisma } from "@/lib/db";

/**
 * Prevents two concurrent requests for the SAME conversation from both
 * calling the AI provider and writing overlapping replies.
 *
 * Why not hold a DB transaction/advisory lock for the whole request?
 * The AI call can take several seconds; holding a Postgres connection
 * (and therefore a slot in the pool) for that long, per in-flight chat
 * message, doesn't scale. Instead this is a short-lived "lease" row
 * update: a single atomic UPDATE claims the right to generate, the
 * slow AI call happens with no lock held, and a `finally` clears the
 * lease. A TTL makes a crashed/timed-out request's lease self-heal
 * instead of wedging the conversation forever.
 *
 * This intentionally does NOT try to serialize different conversations
 * against each other — only concurrent requests within the same
 * conversation, which is the actual ordering hazard described in the
 * spec (two messages arriving close together on one conversation).
 */

const LEASE_TTL_MS = 30_000;

export type LeaseResult = { acquired: true } | { acquired: false };

/**
 * Atomically claims the generation lease. Returns acquired:false if
 * another request already holds a non-stale lease — callers should NOT
 * call the AI provider in that case (see chat/route.ts, which instead
 * tells the customer their message was received and to wait / lets the
 * next poll pick up the in-progress reply).
 */
export async function acquireAiLease(conversationId: string): Promise<LeaseResult> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
    UPDATE "Conversation"
    SET "aiLockedAt" = now()
    WHERE id = $1
      AND ("aiLockedAt" IS NULL OR "aiLockedAt" < now() - ($2 || ' milliseconds')::interval)
    RETURNING id
    `,
    conversationId,
    String(LEASE_TTL_MS),
  );

  return rows.length > 0 ? { acquired: true } : { acquired: false };
}

/** Always call in a finally block after acquireAiLease returned acquired:true. */
export async function releaseAiLease(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { aiLockedAt: null },
  }).catch((err: unknown) => {
    // Releasing the lease is best-effort cleanup; if it fails, the TTL
    // still reclaims it within LEASE_TTL_MS. Don't let a cleanup
    // failure mask the original request's success/failure.
    console.error("Failed to release AI generation lease", { conversationId, err });
  });
}
