/**
 * Loads .env.local before anything that needs DATABASE_URL is imported.
 *
 * Imported for its side effect as the very first import of any test that talks to
 * Postgres: src/lib/db.ts throws at import time when DATABASE_URL is missing, and module
 * imports run in source order, so this has to come first in the file.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const envFile = join(__dirname, "..", "..", process.env.ENV_FILE ?? ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
