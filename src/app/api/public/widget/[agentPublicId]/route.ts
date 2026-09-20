import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handlePreflight, resolveCorsOrigin, withCors } from "@/lib/security/cors";

/**
 * Public, unauthenticated endpoint the widget calls on load. Returns
 * ONLY display/config fields — never internal ids, confidenceThreshold,
 * escalationKeywords, or anything else that could aid abuse or leak
 * business logic.
 */

export async function OPTIONS(req: NextRequest, { params }: { params: { agentPublicId: string } }) {
  const agent = await prisma.agent.findUnique({
    where: { publicId: params.agentPublicId },
    select: { allowedDomains: true },
  });
  return handlePreflight(req, agent?.allowedDomains ?? []);
}

export async function GET(req: NextRequest, { params }: { params: { agentPublicId: string } }) {
  const agent = await prisma.agent.findUnique({
    where: { publicId: params.agentPublicId },
    include: { widgetConfig: true, business: { select: { name: true } } },
  });

  const corsOrigin = resolveCorsOrigin(req, agent?.allowedDomains ?? []);

  if (!agent || !agent.isActive) {
    return withCors(NextResponse.json({ error: "Agent not found" }, { status: 404 }), corsOrigin);
  }

  return withCors(
    NextResponse.json({
      agentPublicId: agent.publicId,
      businessName: agent.business.name,
      agentName: agent.name,
      welcomeMessage: agent.widgetConfig?.welcomeMessage,
      primaryColor: agent.widgetConfig?.primaryColor,
      position: agent.widgetConfig?.position,
      chatButtonText: agent.widgetConfig?.chatButtonText,
      theme: agent.widgetConfig?.theme,
      logoUrl: agent.widgetConfig?.logoUrl,
      avatarUrl: agent.widgetConfig?.avatarUrl,
      humanHandoffMessage: agent.widgetConfig?.humanHandoffMessage,
    }),
    corsOrigin,
  );
}
