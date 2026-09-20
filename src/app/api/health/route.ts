import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public, non-sensitive readiness signal for monitoring deployments. */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ status: "service_unavailable" }, { status: 503 });
  }
  try {
    await prisma.user.count();
    return NextResponse.json({ status: "ready" }, { status: 200 });
  } catch (err) {
    console.error("[health] Database readiness failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ status: "service_unavailable" }, { status: 503 });
  }
}
