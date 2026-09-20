import type { BusinessRole } from "@prisma/client";

/**
 * Single source of truth for what each role can do. Routes call
 * `can(role, "billing.manage")`, never `if (role === "OWNER")` inline —
 * that duplication is exactly how permission drift happens across
 * dozens of routes.
 */
export const PERMISSIONS = {
  "billing.manage": ["OWNER"],
  "business.delete": ["OWNER"],
  "team.manageOwnersAdmins": ["OWNER"],
  "team.invite": ["OWNER", "ADMIN"],
  "team.removeMember": ["OWNER", "ADMIN"],
  "agent.manage": ["OWNER", "ADMIN"],
  "knowledge.manage": ["OWNER", "ADMIN"],
  "settings.manage": ["OWNER", "ADMIN"],
  "analytics.view": ["OWNER", "ADMIN"],
  "conversation.view": ["OWNER", "ADMIN", "AGENT"],
  "conversation.reply": ["OWNER", "ADMIN", "AGENT"],
  "conversation.assign": ["OWNER", "ADMIN", "AGENT"],
  "conversation.note": ["OWNER", "ADMIN", "AGENT"],
  "conversation.status": ["OWNER", "ADMIN", "AGENT"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: BusinessRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly BusinessRole[]).includes(role);
}

/** Throws the same TenantAccessError shape guard.ts uses, for a uniform 403. */
export function assertCan(role: BusinessRole, permission: Permission): void {
  if (!can(role, permission)) {
    const err = new Error(`Role ${role} lacks permission: ${permission}`) as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
