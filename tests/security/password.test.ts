import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("portable password hashing", () => {
  it("hashes and verifies the correct password without storing plaintext", async () => {
    const password = "Safe-Password-For-Testing-1!";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^scrypt\$32768\$/);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("uses a fresh salt for identical passwords", async () => {
    const a = await hashPassword("Same-Password-123!");
    const b = await hashPassword("Same-Password-123!");
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "Same-Password-123!")).toBe(true);
    expect(await verifyPassword(b, "Same-Password-123!")).toBe(true);
  });

  it("rejects unsupported, malformed and corrupted hashes", async () => {
    for (const invalid of ["", "not-a-hash", "$argon2id$legacy", "scrypt$32768$a$b", "scrypt$1$abc$def"]) {
      expect(await verifyPassword(invalid, "anything")).toBe(false);
    }
  });
});
