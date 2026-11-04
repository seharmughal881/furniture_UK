import "server-only";
import { createHash } from "node:crypto";
import { pool } from "./db";

/**
 * Fixed-window rate limiting on the `rate_limits` table.
 *
 * db/schema.sql has described this file since the v6 section but it was never written,
 * so until now no endpoint in the project was rate limited at all. One row per
 * "<action>:<hashed caller>"; the caller is hashed with a salt so no IP address or email
 * is ever stored.
 */

export type RateVerdict = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Bucket key for one caller. `value` (an IP or an email) is salted and hashed, so the
 * table holds no personal data even if it leaks.
 */
export function bucketFor(action: string, value: string): string {
  const salt = process.env.ADMIN_SESSION_SALT ?? "";
  const digest = createHash("sha256").update(`${salt}:${value.toLowerCase()}`).digest("hex");
  return `${action}:${digest.slice(0, 32)}`;
}

/**
 * Count one attempt against `bucket`. Returns ok:false once more than `limit` attempts
 * land inside `windowSeconds`. A single statement, so concurrent attempts cannot race
 * past the limit.
 */
export async function hit(bucket: string, limit: number, windowSeconds: number): Promise<RateVerdict> {
  const { rows } = await pool.query(
    `INSERT INTO rate_limits (bucket, hits, expires_at)
     VALUES ($1, 1, now() + make_interval(secs => $2))
     ON CONFLICT (bucket) DO UPDATE SET
       hits = CASE WHEN rate_limits.expires_at < now() THEN 1 ELSE rate_limits.hits + 1 END,
       expires_at = CASE WHEN rate_limits.expires_at < now()
                         THEN now() + make_interval(secs => $2)
                         ELSE rate_limits.expires_at END
     RETURNING hits, GREATEST(0, ceil(extract(epoch FROM (expires_at - now()))))::int AS retry`,
    [bucket, windowSeconds],
  );
  const row = rows[0] as { hits: number; retry: number };
  return row.hits > limit ? { ok: false, retryAfterSeconds: row.retry } : { ok: true };
}

/**
 * The caller's IP, for rate limiting only. Trustworthy behind Vercel, which overwrites
 * x-forwarded-for; spoofable if this ever runs somewhere that does not. The login limiter
 * therefore also buckets on the submitted email, which an attacker cannot forge away.
 */
export function callerIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
