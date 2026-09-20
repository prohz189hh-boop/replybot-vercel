import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Never log these even if a caller accidentally includes them in
// metadata — audit entries are read by staff/admins and must not
// become a secondary place secrets leak from.
const REDACTED_KEYS = new Set(["password", "passwordHash", "token", "tokenHash", "apiKey", "secret", "sessionId"]);

function redact(value: Record<string, unknown>): Prisma.InputJsonValue {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    clean[key] = REDACTED_KEYS.has(key) ? "[redacted]" : val;
  }
  // JSON.parse(JSON.stringify(...)) collapses this to plain
  // JSON-serializable data, which is what Prisma.InputJsonValue actually
  // requires — avoids the `as any` this used to need to satisfy
  // Prisma's Json input type.
  return JSON.parse(JSON.stringify(clean));
}

export async function logAudit(params: {
  businessId?: string;
  userId?: string;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: {
      businessId: params.businessId,
      userId: params.userId,
      action: params.action,
      metadata: params.metadata ? redact(params.metadata) : Prisma.JsonNull,
      ipAddress: params.ipAddress,
    },
  }).catch((err: unknown) => {
    // Audit logging must never break the primary request path.
    console.error("Failed to write audit log", err);
  });
}
