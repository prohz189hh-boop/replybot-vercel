import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/security/audit";

export async function POST() {
  const session = await getSession();
  await destroySession();
  if (session?.user) {
    await logAudit({ userId: session.user.id, action: "user.logout" });
  }
  return NextResponse.json({ ok: true });
}
