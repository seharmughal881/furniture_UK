/**
 * The admin session cookie name, on its own so proxy.ts can check for it without
 * importing session.ts — which would pull "server-only" and the pg pool into the
 * proxy bundle. No imports belong in this file.
 */
export const ADMIN_COOKIE = "mf_admin";
