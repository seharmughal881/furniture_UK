import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Capability tokens: a secret the holder presents to be allowed to do one thing.
 *
 * Only the SHA-256 hash is ever stored, so a copy of the table hands out no capabilities
 * — the same reasoning as admin_sessions.token_hash and rooms.edit_token_hash.
 *
 * Not reused for admin sessions: session.ts has its own copy and is deliberately left
 * alone, because changing how live session tokens are hashed would sign everyone out.
 */

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A fresh URL-safe token and the hash to store alongside it. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/**
 * Whether a presented token matches a stored hash, compared in constant time so the
 * comparison cannot be used to discover the hash one byte at a time.
 */
export function tokenMatches(token: string | undefined | null, storedHash: string | null): boolean {
  if (!token || !storedHash) return false;
  const presented = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  // timingSafeEqual throws on a length mismatch, so the lengths are checked first.
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}
