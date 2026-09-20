import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session?.user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (session.user.platformRole !== "PLATFORM_ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: Request) {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);

  const [businesses, users, businessCount, userCount] = await Promise.all([
    prisma.business.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { contactEmail: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        subscription: true,
        _count: { select: { members: true, agents: true, conversations: true, knowledgeSources: true } },
      },
    }),
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, email: true, name: true, platformRole: true, emailVerified: true, createdAt: true },
    }),
    prisma.business.count(),
    prisma.user.count(),
  ]);

  return NextResponse.json({
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      website: b.website,
      createdAt: b.createdAt,
      plan: b.subscription?.plan ?? "FREE",
      members: b._count.members,
      agents: b._count.agents,
      conversations: b._count.conversations,
      knowledgeSources: b._count.knowledgeSources,
    })),
    users,
    stats: { businessCount, userCount },
  });
}

const planSchema = z.object({ plan: z.enum(["FREE", "PRO", "BUSINESS"]) });

export async function PATCH(req: Request) {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth.error;

  const id = new URL(req.url).searchParams.get("businessId");
  if (!id) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  const parsed = planSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const subscription = await prisma.subscription.upsert({
    where: { businessId: id },
    create: { businessId: id, plan: parsed.data.plan },
    update: { plan: parsed.data.plan, stripeCustomerId: null, stripeSubscriptionId: null },
  });

  return NextResponse.json({ subscription });
}
