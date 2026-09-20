import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { issueVisitorToken } from "@/lib/widget/visitor-token";
import { checkRateLimit, getTrustedClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";
import { handlePreflight, resolveCorsOrigin, withCors } from "@/lib/security/cors";

const bodySchema = z.object({ agentPublicId: z.string().min(1).max(64) });

export async function OPTIONS(req: Request) {
  const agentPublicId = new URL(req.url).searchParams.get("agentPublicId");
  const agent = agentPublicId
    ? await prisma.agent.findUnique({ where: { publicId: agentPublicId }, select: { allowedDomains: true } })
    : null;
  return handlePreflight(req, agent?.allowedDomains ?? []);
}

export async function POST(req: Request) {
  const ip = getTrustedClientIp(req);
  const rate = await checkRateLimit(`visitor-init:${ip}`, RATE_LIMITS.chat);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const agent = await prisma.agent.findUnique({
    where: { publicId: parsed.data.agentPublicId },
    select: { publicId: true, isActive: true, allowedDomains: true },
  });

  const corsOrigin = resolveCorsOrigin(req, agent?.allowedDomains ?? []);

  if (!agent || !agent.isActive) {
    return withCors(NextResponse.json({ error: "Agent not found" }, { status: 404 }), corsOrigin);
  }

  const { token, visitorId } = issueVisitorToken(agent.publicId);

  // The Customer row is created lazily on first real chat message (see
  // chat/route.ts), not here — minting a token shouldn't itself write a
  // permanent row for every page load that embeds the widget.
  return withCors(NextResponse.json({ token, visitorId }), corsOrigin);
}
