import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runRagPipeline } from "@/lib/rag/pipeline";
import { checkRateLimit, getTrustedClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";
import { handlePreflight, resolveCorsOrigin, withCors } from "@/lib/security/cors";
import { verifyVisitorToken } from "@/lib/widget/visitor-token";
import { reserveUsage, rollbackUsage } from "@/lib/billing/entitlements";
import { acquireAiLease, releaseAiLease } from "@/lib/rag/concurrency";
import type { ChatMessage } from "@/lib/ai/provider";

const bodySchema = z.object({
  agentPublicId: z.string().min(1).max(64),
  visitorToken: z.string().min(1).max(2048),
  message: z.string().min(1).max(4000),
  // UUID the widget generates once per send and resends unchanged on
  // retry, so a network retry can never create a duplicate message.
  clientMessageId: z.string().uuid(),
});

export async function OPTIONS(req: Request) {
  const agentPublicId = new URL(req.url).searchParams.get("agentPublicId");
  const agent = agentPublicId
    ? await prisma.agent.findUnique({ where: { publicId: agentPublicId }, select: { allowedDomains: true } })
    : null;
  return handlePreflight(req, agent?.allowedDomains ?? []);
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { agentPublicId, visitorToken, message, clientMessageId } = parsed.data;

  // Only the public, non-guessable publicId is ever accepted from the
  // widget — never a raw database `id` or `businessId`.
  const agent = await prisma.agent.findUnique({ where: { publicId: agentPublicId } });
  const corsOrigin = resolveCorsOrigin(req, agent?.allowedDomains ?? []);

  if (!agent || !agent.isActive) {
    return withCors(NextResponse.json({ error: "Agent not found" }, { status: 404 }), corsOrigin);
  }

  // Verifies the token was minted by us, for THIS agent, and not
  // expired — a visitor can never supply/choose their own identity, so
  // one visitor cannot impersonate/read another's conversation by
  // guessing or editing an id.
  const visitor = verifyVisitorToken(visitorToken, agentPublicId);
  if (!visitor) {
    return withCors(
      NextResponse.json(
        { error: "Invalid or expired visitor session. Call /api/public/visitor/init again." },
        { status: 401 },
      ),
      corsOrigin,
    );
  }

  // Rate-limit per verified visitor identity, not just per IP — a
  // shared office/NAT IP shouldn't throttle every visitor behind it
  // together, and this can't be spoofed since the token is signed.
  const ip = getTrustedClientIp(req);
  const rate = await checkRateLimit(`chat:${visitor.visitorId}:${ip}`, RATE_LIMITS.chat);
  if (!rate.allowed) {
    return withCors(NextResponse.json({ error: "Too many requests" }, { status: 429 }), corsOrigin);
  }

  const customer = await prisma.customer.upsert({
    where: { businessId_externalId: { businessId: agent.businessId, externalId: visitor.visitorId } },
    create: { businessId: agent.businessId, externalId: visitor.visitorId },
    update: {},
  });

  let conversation = await prisma.conversation.findFirst({
    where: {
      businessId: agent.businessId,
      customerId: customer.id,
      agentId: agent.id,
      status: { not: "RESOLVED" },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { businessId: agent.businessId, agentId: agent.id, customerId: customer.id, status: "AI" },
    });
  }

  // Idempotent insert: if this clientMessageId was already stored for
  // this conversation (a retried request), reuse it instead of
  // creating a duplicate. Uniqueness is enforced by the DB constraint
  // (@@unique([conversationId, clientMessageId])), not just this
  // check-then-insert — a race between two concurrent retries still
  // can't produce two rows, because the loser's INSERT throws P2002
  // and is handled below by re-reading what the winner wrote.
  const existingMessage = await prisma.message.findUnique({
    where: { conversationId_clientMessageId: { conversationId: conversation.id, clientMessageId } },
  });

  let customerMessage = existingMessage;
  let isReplay = Boolean(existingMessage);

  if (!customerMessage) {
    try {
      customerMessage = await prisma.message.create({
        data: { conversationId: conversation.id, sender: "CUSTOMER", content: message, clientMessageId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        customerMessage = await prisma.message.findUniqueOrThrow({
          where: { conversationId_clientMessageId: { conversationId: conversation.id, clientMessageId } },
        });
        isReplay = true;
      } else {
        throw err;
      }
    }
  }

  // If a human already took over, the AI must not auto-respond — the
  // widget just posts the message and the human sees it in the inbox.
  if (conversation.status === "HUMAN" || conversation.status === "WAITING_FOR_HUMAN") {
    if (!isReplay) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { unreadCount: { increment: 1 } },
      });
    }
    return withCors(NextResponse.json({ status: conversation.status, reply: null }), corsOrigin);
  }

  // A replayed request that already got an AI reply the first time
  // should return that same reply, not generate (and bill for) a
  // second one.
  if (isReplay) {
    const existingReply = await prisma.message.findFirst({
      where: { conversationId: conversation.id, sender: "AI", createdAt: { gt: customerMessage.createdAt } },
      orderBy: { createdAt: "asc" },
    });
    if (existingReply) {
      return withCors(NextResponse.json({ status: conversation.status, reply: existingReply.content }), corsOrigin);
    }
    // Fall through — the original request's customer-message insert
    // succeeded but it never produced a reply (crashed/timed out
    // before generating). Try again below.
  }

  // Claim the per-conversation generation lease BEFORE reserving usage
  // or calling the AI provider. If another request (e.g. a message sent
  // a moment earlier, still generating) holds it, don't generate a
  // second, possibly out-of-order reply — the customer's message is
  // already durably stored, and the widget will see the in-progress
  // reply on its next message/poll.
  const lease = await acquireAiLease(conversation.id);
  if (!lease.acquired) {
    return withCors(
      NextResponse.json({ status: conversation.status, reply: null, pending: true }),
      corsOrigin,
    );
  }

  try {
    const reservation = await reserveUsage(agent.businessId, "ai_messages");
    if (!reservation.reserved) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "WAITING_FOR_HUMAN" } });
      return withCors(
        NextResponse.json({ status: "WAITING_FOR_HUMAN", reply: agent.fallbackMessage }),
        corsOrigin,
      );
    }

    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const historyForModel: ChatMessage[] = history
      .filter((m: (typeof history)[number]) => m.sender === "CUSTOMER" || m.sender === "AI")
      .map((m: (typeof history)[number]) => ({
        role: m.sender === "CUSTOMER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

    let result;
    try {
      result = await runRagPipeline({ agent, conversationHistory: historyForModel, customerMessage: message });
    } catch (err) {
      // The reservation already consumed a unit of usage; since no
      // reply was actually produced, give it back rather than charging
      // the business for a failed request.
      await rollbackUsage(agent.businessId, "ai_messages");
      // Never leak provider errors/stack traces to the anonymous visitor.
      console.error("RAG pipeline failure", { agentId: agent.id, conversationId: conversation.id, err });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "WAITING_FOR_HUMAN" } });
      return withCors(
        NextResponse.json({
          status: "WAITING_FOR_HUMAN",
          reply: "Sorry, something went wrong on our end. A team member will follow up shortly.",
        }),
        corsOrigin,
      );
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "AI",
        content: result.answer,
        retrievedChunkIds: result.retrievedChunkIds,
        confidence: result.confidence,
      },
    });

    if (result.shouldEscalate) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "WAITING_FOR_HUMAN" } });
      await prisma.unansweredQuestion.create({
        data: {
          businessId: agent.businessId,
          agentId: agent.id,
          conversationId: conversation.id,
          question: message,
          reason: result.escalationReason ?? "LOW_CONFIDENCE",
        },
      });
    }

    return withCors(
      NextResponse.json({ status: result.shouldEscalate ? "WAITING_FOR_HUMAN" : "AI", reply: result.answer }),
      corsOrigin,
    );
  } finally {
    await releaseAiLease(conversation.id);
  }
}
