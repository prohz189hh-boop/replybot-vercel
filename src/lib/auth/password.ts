import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Portable, memory-hard password hashing via Node's built-in scrypt.
 * Native argon2 was crashing Vercel's Node 24 serverless runtime before
 * signup could start (its binary wasn't included in the deployment).
 * This format includes a random salt and work factor for each password.
 */
const scrypt = promisify(scryptCallback);
const COST = 32768;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const MEMORY_LIMIT = 64 * 1024 * 1024;
const DUMMY_SALT = Buffer.alloc(SALT_BYTES);
const DUMMY_HASH = Buffer.alloc(KEY_BYTES);

async function derive(password: string, salt: Buffer, cost: number): Promise<Buffer> {
  return (await scrypt(password, salt, KEY_BYTES, {
    N: cost,
    r: 8,
    p: 1,
    maxmem: MEMORY_LIMIT,
  })) as Buffer;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(plain, salt, COST);
  return `scrypt$${COST}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  // Always compute a hash for invalid/unknown accounts to avoid fast
  // negative responses that could expose whether an email exists.
  const parts = hash.split("$");
  const validFormat = parts.length === 4 && parts[0] === "scrypt" && parts[1] === String(COST);
  let salt = DUMMY_SALT;
  let expected = DUMMY_HASH;
  if (validFormat) {
    try {
      const parsedSalt = Buffer.from(parts[2] ?? "", "base64url");
      const parsedHash = Buffer.from(parts[3] ?? "", "base64url");
      if (parsedSalt.length === SALT_BYTES && parsedHash.length === KEY_BYTES) {
        salt = parsedSalt;
        expected = parsedHash;
      }
    } catch {
      // Invalid stored hashes are treated as non-matches.
    }
  }
  const actual = await derive(plain, salt, COST);
  const matches = timingSafeEqual(actual, expected);
  return validFormat && salt !== DUMMY_SALT && matches;
}
