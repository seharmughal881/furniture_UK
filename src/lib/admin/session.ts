import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "../db";
import { bucketFor, callerIp, hit } from "../rate-limit";
import { ADMIN_COOKIE } from "./cookie";
import { dummyHash, verifyPassword } from "./passwords";

/**
 * Admin sessions.
 *
 * The cookie carries a random token; the database stores only its SHA-256 hash, so a
 * copy of admin_sessions hands out no live logins (the same reasoning the schema already
 * records for rooms.edit_token_hash). Deleting the row logs that browser out at once.
 */

const COOKIE = ADMIN_COOKIE;
const SESSION_HOURS = 8;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export type AdminUser = { id: number; email: string; name: string; role: "staff" | "manager" };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * The signed-in admin, or null. Reads cookies(), so with cacheComponents enabled every
 * caller must sit inside a <Suspense> boundary — the admin layout provides one.
 *
 * Validation is a plain SELECT so rendering a page performs no writes. The session is
 * only extended once it is past halfway through its life, which keeps a long shift
 * signed in without issuing a row update on every single request.
 */
export async function currentAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role,
            s.expires_at < now() + make_interval(hours => $2) AS "needsRenewal"
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [tokenHash, SESSION_HOURS / 2],
  );
  const row = rows[0] as (AdminUser & { needsRenewal: boolean }) | undefined;
  if (!row) return null;

  if (row.needsRenewal) {
    await pool.query(
      `UPDATE admin_sessions SET expires_at = now() + make_interval(hours => $2) WHERE token_hash = $1`,
      [tokenHash, SESSION_HOURS],
    );
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

/** The guard. Every admin data function calls this before touching the database. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export type SignInResult = { ok: true } | { ok: false; error: string };

/** Verify credentials and start a session. Call only from a Server Action. */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const head = await headers();

  // Two buckets: the IP (spoofable off Vercel) and the submitted email (which an
  // attacker cannot vary while targeting one account).
  const byIp = await hit(bucketFor("login:ip", callerIp(head)), LOGIN_LIMIT, LOGIN_WINDOW_SECONDS);
  const byEmail = await hit(bucketFor("login:email", email), LOGIN_LIMIT, LOGIN_WINDOW_SECONDS);
  if (!byIp.ok || !byEmail.ok) {
    const wait = Math.max(byIp.ok ? 0 : byIp.retryAfterSeconds, byEmail.ok ? 0 : byEmail.retryAfterSeconds);
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` };
  }

  const { rows } = await pool.query(
    `SELECT id, password_hash AS "passwordHash", active FROM admin_users WHERE email = lower($1)`,
    [email],
  );
  const user = rows[0] as { id: number; passwordHash: string; active: boolean } | undefined;

  // Always run a verification, even with no such account, so timing does not reveal
  // which email addresses exist.
  const good = await verifyPassword(password, user?.active ? user.passwordHash : await dummyHash());
  if (!user || !user.active || !good) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at, user_agent)
     VALUES ($1, $2, now() + make_interval(hours => $3), $4)`,
    [hashToken(token), user.id, SESSION_HOURS, (head.get("user-agent") ?? "").slice(0, 300)],
  );
  await pool.query(`UPDATE admin_users SET last_login_at = now() WHERE id = $1`, [user.id]);

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    // Stricter than the storefront's atelier_cart cookie: "strict" means no cross-site
    // request carries it, which is what blocks CSRF against the admin.
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return { ok: true };
}

/** End this browser's session, server-side as well as in the cookie. */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await pool.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [hashToken(token)]);
  }
  jar.delete(COOKIE);
}
