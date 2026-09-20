import argon2 from "argon2";

/**
 * argon2id — memory-hard, side-channel resistant. Never swap this for
 * bcrypt/sha256 "for simplicity"; password hashing is not a place to
 * cut corners.
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
