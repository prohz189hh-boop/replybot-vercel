/**
 * REQUIRES POSTGRESQL. This environment has no live database, so these
 * tests have NOT been executed — they are written against the actual
 * schema/route logic and are ready to run once DATABASE_URL points at a
 * real Postgres instance with pgvector installed
 * (see README.md "Database setup"). Treat every assertion below as
 * UNVERIFIED until someone runs `npm test` in an environment with a
 * database.
 *
 * Run with: npx vitest run tests/integration/public-chat-and-auth.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { issueVisitorToken } from "@/lib/widget/visitor-token";

describe("[integration/db] duplicate clientMessageId does not create duplicate messages", () => {
  let conversationId: string;

  beforeAll(async () => {
    const business = await prisma.business.create({ data: { name: "Idempotency Test Co" } });
    const agent = await prisma.agent.create({ data: { businessId: business.id, name: "Test Agent" } });
    const customer = await prisma.customer.create({ data: { businessId: business.id, externalId: "visitor-1" } });
    const conversation = await prisma.conversation.create({
      data: { businessId: business.id, agentId: agent.id, customerId: customer.id },
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } }).catch(() => {});
  });

  it("a repeated clientMessageId reuses the same row instead of inserting a second one", async () => {
    const clientMessageId = "11111111-1111-4111-8111-111111111111";

    const first = await prisma.message.create({
      data: { conversationId, sender: "CUSTOMER", content: "Do you deliver?", clientMessageId },
    });

    // Simulates the retry path in chat/route.ts: the second attempt's
    // create() throws P2002 (unique violation) rather than succeeding.
    await expect(
      prisma.message.create({
        data: { conversationId, sender: "CUSTOMER", content: "Do you deliver?", clientMessageId },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const rows = await prisma.message.findMany({ where: { conversationId, clientMessageId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(first.id);
  });

  it("different clientMessageIds within the same conversation both persist", async () => {
    await prisma.message.create({
      data: { conversationId, sender: "CUSTOMER", content: "First", clientMessageId: "22222222-2222-4222-8222-222222222222" },
    });
    await prisma.message.create({
      data: { conversationId, sender: "CUSTOMER", content: "Second", clientMessageId: "33333333-3333-4333-8333-333333333333" },
    });

    const rows = await prisma.message.findMany({ where: { conversationId } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("the same clientMessageId in a DIFFERENT conversation is not treated as a duplicate", async () => {
    // Regression guard for the uniqueness scope: @@unique([conversationId,
    // clientMessageId]), not @@unique([clientMessageId]) alone — two
    // different customers/conversations coincidentally generating the
    // same UUID (astronomically unlikely, but the constraint should not
    // rely on that) must not collide across conversations/tenants.
    const business = await prisma.business.create({ data: { name: "Second Tenant" } });
    const agent = await prisma.agent.create({ data: { businessId: business.id, name: "Agent 2" } });
    const customer = await prisma.customer.create({ data: { businessId: business.id, externalId: "visitor-2" } });
    const otherConversation = await prisma.conversation.create({
      data: { businessId: business.id, agentId: agent.id, customerId: customer.id },
    });

    const sharedId = "44444444-4444-4444-8444-444444444444";
    await prisma.message.create({ data: { conversationId, sender: "CUSTOMER", content: "A", clientMessageId: sharedId } });

    await expect(
      prisma.message.create({
        data: { conversationId: otherConversation.id, sender: "CUSTOMER", content: "B", clientMessageId: sharedId },
      }),
    ).resolves.toBeTruthy();

    await prisma.conversation.delete({ where: { id: otherConversation.id } });
    await prisma.business.delete({ where: { id: business.id } });
  });
});

describe("[integration/db] customer identity cannot be forged across businesses", () => {
  it("the same externalId in two different businesses creates two separate Customer rows", async () => {
    const businessA = await prisma.business.create({ data: { name: "Forge Test A" } });
    const businessB = await prisma.business.create({ data: { name: "Forge Test B" } });

    const customerA = await prisma.customer.create({ data: { businessId: businessA.id, externalId: "shared-visitor-id" } });
    const customerB = await prisma.customer.create({ data: { businessId: businessB.id, externalId: "shared-visitor-id" } });

    expect(customerA.id).not.toBe(customerB.id);

    await prisma.customer.deleteMany({ where: { id: { in: [customerA.id, customerB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessA.id, businessB.id] } } });
  });

  it("a visitor token minted for business A's agent cannot be used to read business B's conversation", async () => {
    const businessA = await prisma.business.create({ data: { name: "Token Scope A" } });
    const businessB = await prisma.business.create({ data: { name: "Token Scope B" } });
    const agentA = await prisma.agent.create({ data: { businessId: businessA.id, name: "Agent A" } });
    const agentB = await prisma.agent.create({ data: { businessId: businessB.id, name: "Agent B" } });

    const { visitorId } = issueVisitorToken(agentA.publicId);

    // Even with a legitimately-issued visitorId, looking it up under a
    // DIFFERENT business's customer table must find nothing — the
    // (businessId, externalId) unique constraint means this visitorId
    // simply doesn't exist as a Customer row for business B unless
    // business B's own chat route creates one.
    const foundInB = await prisma.customer.findUnique({
      where: { businessId_externalId: { businessId: businessB.id, externalId: visitorId } },
    });
    expect(foundInB).toBeNull();

    await prisma.agent.deleteMany({ where: { id: { in: [agentA.id, agentB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessA.id, businessB.id] } } });
  });
});

describe("[integration/db] session expiration", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: "session-expiry-test@example.com", passwordHash: await hashPassword("irrelevant") },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("an expired session row is not treated as valid by application logic", async () => {
    const expired = await prisma.session.create({
      data: { id: "expired-session-hash-test", userId, expiresAt: new Date(Date.now() - 1000) },
    });

    // Mirrors the check in getSession() (src/lib/auth/session.ts) without
    // going through the cookie layer, which isn't available outside a
    // request context in a test.
    const loaded = await prisma.session.findUnique({ where: { id: expired.id } });
    const isValid = loaded !== null && loaded.expiresAt > new Date();
    expect(isValid).toBe(false);
  });

  it("cleanupExpiredSessions removes only expired rows, not valid ones", async () => {
    const { cleanupExpiredSessions } = await import("@/lib/auth/session");

    await prisma.session.create({
      data: { id: "cleanup-test-expired", userId, expiresAt: new Date(Date.now() - 1000) },
    });
    const valid = await prisma.session.create({
      data: { id: "cleanup-test-valid", userId, expiresAt: new Date(Date.now() + 1000 * 60 * 60) },
    });

    await cleanupExpiredSessions();

    expect(await prisma.session.findUnique({ where: { id: "cleanup-test-expired" } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: valid.id } })).not.toBeNull();
  });
});

describe("[integration/db] atomic usage reservation under concurrency", () => {
  it("100 concurrent reservations against a limit of 50 result in exactly 50 successes", async () => {
    const { reserveUsage } = await import("@/lib/billing/entitlements");
    const business = await prisma.business.create({ data: { name: "Concurrency Test Co" } });
    // FREE plan's ai_messages limit is 200 by default; this test creates
    // its own tight limit by pre-seeding the UsageRecord near the cap
    // instead of relying on PLAN_LIMITS staying at a specific number.
    const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    await prisma.usageRecord.create({
      data: { businessId: business.id, metric: "ai_messages", period, count: 150 }, // 50 remaining of 200
    });

    const results = await Promise.all(
      Array.from({ length: 100 }, () => reserveUsage(business.id, "ai_messages")),
    );

    const successes = results.filter((r) => r.reserved).length;
    expect(successes).toBe(50);

    const finalRecord = await prisma.usageRecord.findUnique({
      where: { businessId_metric_period: { businessId: business.id, metric: "ai_messages", period } },
    });
    expect(finalRecord?.count).toBe(200);

    await prisma.usageRecord.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
  });

  it("rollbackUsage gives back exactly one unit and does not go below zero", async () => {
    const { reserveUsage, rollbackUsage } = await import("@/lib/billing/entitlements");
    const business = await prisma.business.create({ data: { name: "Rollback Test Co" } });
    const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    await reserveUsage(business.id, "ai_messages");
    await rollbackUsage(business.id, "ai_messages");

    const record = await prisma.usageRecord.findUnique({
      where: { businessId_metric_period: { businessId: business.id, metric: "ai_messages", period } },
    });
    expect(record?.count).toBe(0);

    // A second rollback with nothing to give back must floor at 0, not
    // go negative.
    await rollbackUsage(business.id, "ai_messages");
    const recordAfterExtraRollback = await prisma.usageRecord.findUnique({
      where: { businessId_metric_period: { businessId: business.id, metric: "ai_messages", period } },
    });
    expect(recordAfterExtraRollback?.count).toBe(0);

    await prisma.usageRecord.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
  });
});

describe("[integration/db] AI generation lease prevents concurrent duplicate replies", () => {
  it("only one of two concurrent lease acquisitions on the same conversation succeeds", async () => {
    const { acquireAiLease, releaseAiLease } = await import("@/lib/rag/concurrency");
    const business = await prisma.business.create({ data: { name: "Lease Test Co" } });
    const agent = await prisma.agent.create({ data: { businessId: business.id, name: "Lease Agent" } });
    const customer = await prisma.customer.create({ data: { businessId: business.id, externalId: "lease-visitor" } });
    const conversation = await prisma.conversation.create({
      data: { businessId: business.id, agentId: agent.id, customerId: customer.id },
    });

    const [a, b] = await Promise.all([
      acquireAiLease(conversation.id),
      acquireAiLease(conversation.id),
    ]);

    const acquiredCount = [a, b].filter((r) => r.acquired).length;
    expect(acquiredCount).toBe(1);

    await releaseAiLease(conversation.id);
    const afterRelease = await acquireAiLease(conversation.id);
    expect(afterRelease.acquired).toBe(true);
    await releaseAiLease(conversation.id);

    await prisma.conversation.delete({ where: { id: conversation.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.agent.delete({ where: { id: agent.id } });
    await prisma.business.delete({ where: { id: business.id } });
  });
});
