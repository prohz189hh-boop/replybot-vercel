import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

/**
 * requireBusinessAccess/requirePermission depend on getSession(), which
 * in production reads an httpOnly cookie via next/headers — not
 * available outside a real request. Mocking getSession() here lets us
 * exercise the actual authorization branches (right role, wrong role,
 * no membership at all) as true unit tests, rather than only being able
 * to test the "no session" path like cross-tenant-access.test.ts does.
 *
 * REQUIRES POSTGRESQL for the businessMember lookups — see
 * tests/integration/ for the fully-marked integration suite. This file
 * mixes a mocked auth layer with real Prisma calls, so it still needs a
 * live database; it is NOT a pure unit test despite mocking getSession.
 */

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireBusinessAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";

// getSession()'s real return type is the full Prisma Session row plus
// its included `user` relation — far more fields than these tests care
// about. Rather than reach for `as any` (which would also silently
// swallow a real shape mismatch if getSession's return type ever
// changes), build a minimal-but-correctly-typed stand-in via
// `Awaited<ReturnType<typeof getSession>>` and only fill the fields
// requireBusinessAccess/requirePermission actually read (`user.id`).
type MockSession = Awaited<ReturnType<typeof getSession>>;
function sessionFor(userId: string): MockSession {
  return { user: { id: userId } } as unknown as MockSession;
}

describe("[integration/db] tenant guard with a mocked authenticated session", () => {
  let businessId: string;
  let ownerUserId: string;
  let agentUserId: string;
  let outsiderUserId: string;

  beforeAll(async () => {
    const business = await prisma.business.create({ data: { name: "Guard Test Co" } });
    businessId = business.id;

    const owner = await prisma.user.create({ data: { email: "guard-owner@test.dev", passwordHash: "x" } });
    const agentUser = await prisma.user.create({ data: { email: "guard-agent@test.dev", passwordHash: "x" } });
    const outsider = await prisma.user.create({ data: { email: "guard-outsider@test.dev", passwordHash: "x" } });
    ownerUserId = owner.id;
    agentUserId = agentUser.id;
    outsiderUserId = outsider.id;

    await prisma.businessMember.create({ data: { businessId, userId: owner.id, role: "OWNER" } });
    await prisma.businessMember.create({ data: { businessId, userId: agentUser.id, role: "AGENT" } });
    // outsider deliberately has NO membership row for this business.
  });

  afterAll(async () => {
    await prisma.businessMember.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, agentUserId, outsiderUserId] } } });
  });

  beforeEach(() => {
    vi.mocked(getSession).mockReset();
  });

  it("allows an OWNER to access their own business at AGENT-level requirement", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor(ownerUserId));
    const { membership } = await requireBusinessAccess(businessId, "AGENT");
    expect(membership.role).toBe("OWNER");
  });

  it("denies an AGENT trying to meet an OWNER-level requirement (403)", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor(agentUserId));
    await expect(requireBusinessAccess(businessId, "OWNER")).rejects.toMatchObject({ status: 403 });
  });

  it("denies a user with no membership row at all (404, not 403 — don't leak existence)", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor(outsiderUserId));
    await expect(requireBusinessAccess(businessId, "AGENT")).rejects.toMatchObject({ status: 404 });
  });

  it("denies an unauthenticated caller (401)", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(requireBusinessAccess(businessId, "AGENT")).rejects.toMatchObject({ status: 401 });
  });

  it("requirePermission: AGENT can reply to conversations but not manage billing", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor(agentUserId));
    await expect(requirePermission(businessId, "conversation.reply")).resolves.toBeTruthy();
    await expect(requirePermission(businessId, "billing.manage")).rejects.toMatchObject({ status: 403 });
  });

  it("a fabricated businessId that does not exist is denied identically to one that exists but isn't yours", async () => {
    // Guards against an IDOR-style probe: the error for "wrong tenant"
    // and "business doesn't exist" must be indistinguishable so an
    // attacker can't use response differences to enumerate real
    // business IDs.
    vi.mocked(getSession).mockResolvedValue(sessionFor(outsiderUserId));
    let realBusinessError: unknown;
    let fakeBusinessError: unknown;
    try {
      await requireBusinessAccess(businessId, "AGENT");
    } catch (e) {
      realBusinessError = e;
    }
    try {
      await requireBusinessAccess("nonexistent-business-id", "AGENT");
    } catch (e) {
      fakeBusinessError = e;
    }
    expect((realBusinessError as TenantAccessError).status).toBe((fakeBusinessError as TenantAccessError).status);
    expect((realBusinessError as TenantAccessError).message).toBe((fakeBusinessError as TenantAccessError).message);
  });
});
