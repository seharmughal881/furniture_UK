import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { bucketFor, callerIp, hit } from "@/lib/rate-limit";

/**
 * Completes a newsletter double opt-in: GET /api/newsletter/confirm?token=…
 *
 * A GET that changes state is acceptable here only because this is the target of a link
 * in an email, which is the one case where a browser cannot send anything else. The token
 * is single use -- it is cleared as the row is confirmed -- so the link cannot be replayed
 * and a leaked token grants nothing afterwards.
 *
 * Rate limited because the token is a secret being guessed at: without a limit this is an
 * oracle you could brute force.
 *
 * The reply is deliberately the same for an unknown, already-used and malformed token, so
 * nothing here reveals whether a given token or address exists.
 */

const PER_HOUR = 20;
const HOUR_SECONDS = 60 * 60;

const page = (title: string, body: string, status: number) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;
background:#fbfaf7;color:#17150f;text-align:center;padding:24px}main{max-width:32rem}
h1{font-size:1.5rem;margin:0 0 .5rem}p{margin:0;color:#6a6558}a{color:#c8102e}</style></head>
<body><main><h1>${title}</h1><p>${body}</p><p><a href="/">Back to Muscat Furniture</a></p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";

  const quota = await hit(bucketFor("newsletter:confirm", callerIp(await headers())), PER_HOUR, HOUR_SECONDS);
  if (!quota.ok) return page("Please try again shortly", "Too many attempts from this connection.", 429);

  // Length-checked before touching the database so an absurd query string is cheap.
  if (token.length < 20 || token.length > 100) {
    return page("That link is not valid", "It may have already been used. Please sign up again.", 400);
  }

  const { rows } = await pool.query(
    `UPDATE newsletter SET confirmed = true, confirmed_at = now(), confirm_token = NULL
     WHERE confirm_token = $1 AND NOT confirmed
     RETURNING email`,
    [token],
  );

  return rows[0]
    ? page("You are subscribed", "Thank you for confirming. We will be in touch when something good arrives.", 200)
    : page("That link is not valid", "It may have already been used. Please sign up again.", 400);
}
