/**
 * Tenant isolation guard.
 *
 * CRITICAL: every server-side read/write that touches a tenant-scoped
 * model (Agent, KnowledgeSource, Conversation, Customer, etc.) MUST go
 * through `requireBusinessAccess` first, and every Prisma query MUST
 * include `businessId: business.id` in its `where` clause.
 *
 * Never trust a `businessId` passed in the request body/query string —
 * only the one resolved here from the authenticated session's
 * memberships. This is what tests/tenant-isolation/* verify.
 */

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/tenant/permissions";
import type { BusinessRole } from "@prisma/client";

export class TenantAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

const ROLE_RANK: Record<BusinessRole, number> = {
  AGENT: 0,
  ADMIN: 1,
  OWNER: 2,
};

/**
 * Resolves the authenticated user's membership in `businessId` and
 * throws if they have none, or if their role is below `minRole`.
 * Returns the membership row so callers can branch on exact role.
 */
export async function requireBusinessAccess(
  businessId: string,
  minRole: BusinessRole = "AGENT",
) {
  const session = await getSession();
  if (!session?.user) {
    throw new TenantAccessError("Not authenticated", 401);
  }

  const membership = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    // Deliberately identical error/shape whether the business exists or
    // not, and whether the user is a stranger or just under-privileged —
    // don't leak existence of other tenants' resources.
    throw new TenantAccessError("Not found", 404);
  }

  if (ROLE_RANK[membership.role as BusinessRole] < ROLE_RANK[minRole]) {
    throw new TenantAccessError("Insufficient permissions", 403);
  }

  return { session, membership };
}

/**
 * Helper for resource-level checks: loads a resource by id, confirms it
 * belongs to a business the caller has access to, and returns both.
 * Use for every /dashboard/api/* route that operates on a single
 * agent/conversation/knowledge-source/etc.
 *
 * Example:
 *   const { resource: agent } = await requireResourceAccess(
 *     () => prisma.agent.findUnique({ where: { id: agentId } }),
 *     (agent) => agent?.businessId,
 *   );
 */
export async function requireResourceAccess<T>(
  loadResource: () => Promise<T | null>,
  getBusinessId: (resource: T) => string | undefined,
  minRole: BusinessRole = "AGENT",
) {
  const resource = await loadResource();
  const businessId = resource ? getBusinessId(resource) : undefined;

  if (!resource || !businessId) {
    throw new TenantAccessError("Not found", 404);
  }

  const { session, membership } = await requireBusinessAccess(businessId, minRole);
  return { resource, session, membership };
}

/**
 * Fine-grained variant of requireBusinessAccess for actions that don't
 * map cleanly to a single role threshold (e.g. AGENT can reply to
 * conversations but not manage billing, which isn't just "rank >= X").
 * Prefer this over minRole for anything defined in permissions.ts.
 */
export async function requirePermission(businessId: string, permission: Permission) {
  const session = await getSession();
  if (!session?.user) {
    throw new TenantAccessError("Not authenticated", 401);
  }

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: session.user.id } },
  });

  if (!membership) {
    throw new TenantAccessError("Not found", 404);
  }

  if (!can(membership.role, permission)) {
    throw new TenantAccessError("Insufficient permissions", 403);
  }

  return { session, membership };
}
