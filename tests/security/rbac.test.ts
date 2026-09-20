import { describe, it, expect } from "vitest";
import { can, assertCan, PERMISSIONS } from "@/lib/tenant/permissions";

describe("centralized RBAC (permissions.ts)", () => {
  it("OWNER can manage billing; ADMIN and AGENT cannot", () => {
    expect(can("OWNER", "billing.manage")).toBe(true);
    expect(can("ADMIN", "billing.manage")).toBe(false);
    expect(can("AGENT", "billing.manage")).toBe(false);
  });

  it("ADMIN can invite team members; AGENT cannot", () => {
    expect(can("ADMIN", "team.invite")).toBe(true);
    expect(can("AGENT", "team.invite")).toBe(false);
  });

  it("AGENT can reply to conversations", () => {
    expect(can("AGENT", "conversation.reply")).toBe(true);
  });

  it("only OWNER can delete the business", () => {
    expect(can("OWNER", "business.delete")).toBe(true);
    expect(can("ADMIN", "business.delete")).toBe(false);
    expect(can("AGENT", "business.delete")).toBe(false);
  });

  it("assertCan throws a 403-shaped error for an unauthorized role, and never for an authorized one", () => {
    expect(() => assertCan("AGENT", "billing.manage")).toThrow();

    let caught: unknown;
    try {
      assertCan("AGENT", "billing.manage");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error & { status?: number }).status).toBe(403);
  });

  it("assertCan does not throw for an authorized role", () => {
    expect(() => assertCan("OWNER", "billing.manage")).not.toThrow();
  });

  it("every permission lists at least one role (no accidentally-unreachable permission)", () => {
    for (const [, roles] of Object.entries(PERMISSIONS)) {
      expect(roles.length).toBeGreaterThan(0);
    }
  });
});
