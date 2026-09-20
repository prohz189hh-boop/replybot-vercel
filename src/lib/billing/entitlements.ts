import { prisma } from "@/lib/db";
import type { PlanTier } from "@prisma/client";

/**
 * Single source of truth for plan limits. Every feature that's
 * plan-gated reads from here — never hard-code a limit inline in a
 * route handler.
 */
export const PLAN_LIMITS: Record<PlanTier, Record<string, number>> = {
  FREE: { agents: 1, ai_messages: 200, knowledge_sources: 5, team_members: 2 },
  PRO: { agents: 5, ai_messages: 5000, knowledge_sources: 50, team_members: 10 },
  BUSINESS: { agents: 25, ai_messages: 50000, knowledge_sources: 500, team_members: 50 },
};

export class UsageLimitError extends Error {
  constructor(public metric: string, public limit: number) {
    super(`Usage limit reached for ${metric} (limit: ${limit})`);
  }
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getPlan(businessId: string): Promise<PlanTier> {
  const sub = await prisma.subscription.findUnique({ where: { businessId } });
  return sub?.plan ?? "FREE";
}

/**
 * Non-metered, resource-count limits (agents/knowledge sources/team
 * seats). These are gated by "COUNT(*) < limit" at creation time, from
 * dashboard routes a human clicks — not a high-concurrency public
 * endpoint — so a narrow TOCTOU window here (two admins clicking
 * "add agent" in the same millisecond) is a much lower-severity risk
 * than the AI-usage race below, and is not addressed by this pass.
 * If that becomes a real requirement, apply the same reserve-row
 * pattern as reserveUsage() below, keyed by metric name.
 */
export async function enforceResourceLimit(
  businessId: string,
  metric: "agents" | "knowledge_sources" | "team_members",
) {
  const plan = await getPlan(businessId);
  const limit = PLAN_LIMITS[plan][metric];

  let current: number;
  if (metric === "agents") {
    current = await prisma.agent.count({ where: { businessId } });
  } else if (metric === "knowledge_sources") {
    current = await prisma.knowledgeSource.count({ where: { businessId } });
  } else {
    current = await prisma.businessMember.count({ where: { businessId } });
  }

  if (current >= limit) {
    throw new UsageLimitError(metric, limit);
  }
}

/**
 * Atomically reserves one unit of a metered resource (currently only
 * "ai_messages") — this is the fix for the race described in the spec:
 *
 *   check usage (199/200) -> [concurrent request B also sees 199/200]
 *   both generate -> both increment -> 201/200
 *
 * Implemented as a single INSERT ... ON CONFLICT ... DO UPDATE ... WHERE
 * statement. Postgres evaluates and applies this as one atomic
 * operation per row: the WHERE clause on the DO UPDATE is checked
 * against the CURRENT row value at update time, under the row lock the
 * UPDATE itself takes — a second concurrent statement targeting the
 * same row blocks until the first commits, then re-evaluates the WHERE
 * against the now-updated count. There is no gap between "read count"
 * and "write count" for two callers to both slip through.
 *
 * Returns whether the reservation succeeded. On success, the caller now
 * "owns" one unit of usage and MUST call rollbackUsage() if the metered
 * action (the AI call) subsequently fails, so a failed request doesn't
 * permanently cost the business part of their quota.
 */
export async function reserveUsage(
  businessId: string,
  metric: string,
): Promise<{ reserved: true } | { reserved: false; limit: number }> {
  const plan = await getPlan(businessId);
  const limit = PLAN_LIMITS[plan][metric as keyof (typeof PLAN_LIMITS)["FREE"]];
  const period = currentPeriod();

  const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
    INSERT INTO "UsageRecord" (id, "businessId", metric, period, count, "updatedAt")
    VALUES (gen_random_uuid()::text, $1, $2, $3, 1, now())
    ON CONFLICT ("businessId", metric, period)
    DO UPDATE SET count = "UsageRecord".count + 1, "updatedAt" = now()
    WHERE "UsageRecord".count < $4
    RETURNING count
    `,
    businessId,
    metric,
    period,
    limit,
  );

  return rows.length > 0 ? { reserved: true } : { reserved: false, limit };
}

/**
 * Releases a reservation made by reserveUsage() when the metered action
 * ultimately failed (e.g. the AI provider errored after usage was
 * reserved but before a reply was produced). Floors at 0 so a
 * duplicate/late rollback can't push the counter negative.
 */
export async function rollbackUsage(businessId: string, metric: string): Promise<void> {
  const period = currentPeriod();
  await prisma.$executeRawUnsafe(
    `
    UPDATE "UsageRecord"
    SET count = GREATEST(count - 1, 0), "updatedAt" = now()
    WHERE "businessId" = $1 AND metric = $2 AND period = $3
    `,
    businessId,
    metric,
    period,
  );
}
