import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const ACTIVE_BUSINESS_COOKIE = "replypilot_active_business";

async function resolveContext() {
  const session = await getSession();
  if (!session?.user) return null;

  const memberships = await prisma.businessMember.findMany({
    where: { userId: session.user.id },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) return { session, memberships: [] as typeof memberships, active: null };

  const cookieBusinessId = cookies().get(ACTIVE_BUSINESS_COOKIE)?.value;
  const active = memberships.find((m) => m.businessId === cookieBusinessId) ?? memberships[0];
  return { session, memberships, active };
}

/**
 * For Server Components (pages/layouts) only. Redirects to /login or
 * /onboarding — `redirect()` is only meaningful where Next.js is
 * rendering a page, and a fetch()-based client would otherwise receive
 * an HTML redirect response where it expects JSON. API routes must use
 * resolveDashboardContextForApi() instead.
 */
export async function requireDashboardContext() {
  const ctx = await resolveContext();
  if (!ctx) redirect("/login");
  if (!ctx.active) redirect("/onboarding");

  return {
    user: ctx.session.user,
    business: ctx.active.business,
    role: ctx.active.role,
    membershipId: ctx.active.id, // BusinessMember.id — what Conversation.assignedToId actually stores
    memberships: ctx.memberships,
  };
}

/**
 * For Route Handlers under /api/dashboard/*. Never redirects — returns
 * null so the caller can respond with a proper 401/404 JSON body
 * instead of an HTML redirect a fetch() caller can't use.
 */
export async function resolveDashboardContextForApi() {
  const ctx = await resolveContext();
  if (!ctx || !ctx.active) return null;
  return {
    user: ctx.session.user,
    business: ctx.active.business,
    role: ctx.active.role,
    membershipId: ctx.active.id,
    memberships: ctx.memberships,
  };
}

export function setActiveBusinessCookie(businessId: string) {
  cookies().set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
