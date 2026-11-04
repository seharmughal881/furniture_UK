import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing with scrypt from node:crypto — no password library, matching this
 * project's zero-dependency server style.
 *
 * Deliberately no `import "server-only"`, following the same split as models3d-core.ts:
 * this file is pure computation over its arguments, with no database and no ambient
 * secret, so `npm run admin:create` can import it under tsx (where server-only throws).
 * The modules that do touch the database and cookies — session.ts and orders.ts — carry
 * the guard instead. Importing node:crypto already fails any client build on its own.
 *
 * Hashes are stored self-describing as `scrypt$N$r$p$<salt base64>$<key base64>`, and
 * verification reads the cost parameters back out of the stored string. That means the
 * constants below can be raised later without invalidating anyone's existing password.
 */

type ScryptOptions = { N: number; r: number; p: number; maxmem: number };
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const N = 32768; // CPU/memory cost
const R = 8; // block size
const P = 1; // parallelisation
const KEYLEN = 64;
const SALT_BYTES = 16;

// scrypt needs roughly 128 * N * r bytes = exactly 32 MiB at N=32768, r=8, which is
// Node's *default* maxmem — so the default throws "memory limit exceeded". Ask for more.
const MAXMEM = 64 * 1024 * 1024;

/** Unicode-normalise so the same typed password always produces the same bytes. */
const prepare = (password: string) => password.normalize("NFKC");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(prepare(password), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const cost = { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM };
  if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) return false;

  const expected = Buffer.from(keyB64, "base64");
  let actual: Buffer;
  try {
    actual = await scrypt(prepare(password), Buffer.from(saltB64, "base64"), expected.length, cost);
  } catch {
    return false;
  }
  // timingSafeEqual throws on a length mismatch, so check that first.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * A throwaway hash to verify against when the email is unknown, so a login attempt for a
 * non-existent account costs the same time as a wrong password for a real one. Without
 * this, response timing tells an attacker which email addresses are real accounts.
 * Computed once per process, then reused.
 */
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(32).toString("hex"));
  return dummy;
}
