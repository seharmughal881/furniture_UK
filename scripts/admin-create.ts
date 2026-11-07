// Creates or resets a back-office staff account. Run:
//   npm run admin:create -- someone@mfi.om "Their Name" [staff|manager]
// A strong password is generated and printed once. To choose your own instead:
//   ADMIN_PASSWORD='...' npm run admin:create -- someone@mfi.om "Their Name"
// Re-running for an existing email resets that account's password.
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { hashPassword } from "../src/lib/admin/passwords";

// Same convention as db-setup.ts: ENV_FILE or .env.local, shell variables win.
const envFile = join(__dirname, "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local, pass ENV_FILE=..., or set it in the shell.");
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [email, name, role = "staff"] = args;

if (!email || !name) {
  console.error('Usage: npm run admin:create -- someone@mfi.om "Their Name" [staff|manager]');
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`"${email}" does not look like an email address.`);
  process.exit(1);
}
if (role !== "staff" && role !== "manager") {
  console.error(`Role must be "staff" or "manager", not "${role}".`);
  process.exit(1);
}

/** Readable but strong: 24 base64url characters, ~144 bits. */
const generatePassword = () => randomBytes(18).toString("base64url");

/**
 * Say which database the account is being created in, host only, never the password.
 *
 * Without this the output is ambiguous: "Created manager account" looks identical whether
 * it ran against production or fell back to .env.local because DATABASE_URL was not
 * exported -- and an admin account created in the wrong database simply cannot sign in.
 */
const target = (() => {
  try {
    const u = new URL(process.env.DATABASE_URL!);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
})();

async function main() {
  console.log(`\nTarget database: ${target}`);
  const chosen = process.env.ADMIN_PASSWORD;
  if (chosen && chosen.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }
  const password = chosen ?? generatePassword();
  const passwordHash = await hashPassword(password);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_users (email, name, password_hash, role)
       VALUES (lower($1), $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role, active = true
       RETURNING id, email, name, role, (created_at = now()) AS created`,
      [email, name, passwordHash, role],
    );
    const user = rows[0];

    // Any existing sessions for this account are no longer trustworthy once the
    // password changes, so sign that person out of every browser.
    const { rowCount } = await pool.query(`DELETE FROM admin_sessions WHERE admin_user_id = $1`, [user.id]);

    console.log(`\n${user.created ? "Created" : "Updated"} ${user.role} account for ${user.name} <${user.email}>`);
    if (rowCount) console.log(`Signed out ${rowCount} existing session(s) for this account.`);
    if (chosen) {
      console.log("\nPassword: (the one you passed in ADMIN_PASSWORD)");
    } else {
      console.log(`\n  Password: ${password}`);
      console.log("\n  Save it now — it is not stored anywhere and cannot be shown again.");
    }
    console.log("\nSign in at /admin/login\n");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
