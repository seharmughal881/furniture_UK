/**
 * Regenerates db/neon-setup.sql. Run: npm run db:neon-sql
 *
 * neon-setup.sql is the copy/paste-into-Neon version of the schema. It was previously
 * maintained by hand and drifted several migrations behind db/schema.sql, which silently
 * produced databases without site_content (breaking every storefront page) and without
 * the v8/v9 admin columns. Concatenating it from the authoritative sources means it can
 * no longer disagree with them.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const db = join(__dirname, "..", "db");
const read = (name: string) => readFileSync(join(db, name), "utf8");

const header = `-- Muscat Furniture: full database setup for a new, empty PostgreSQL database (e.g. Neon).
-- Paste into Neon -> SQL Editor -> Run. Safe to run more than once.
--
-- GENERATED FILE -- do not hand-edit. Regenerate with:  npm run db:neon-sql
--
-- Sources, concatenated in order:
--   db/schema.sql          the authoritative schema (what \`npm run db:setup\` applies)
--   db/seed-catalogue.sql  the seed materials, products and sample reviews
--
-- This file used to be hand-maintained and drifted badly: it had stopped at v7, so a
-- database created from it was missing the v8 product columns (stock_qty, subcategory,
-- vendor) and product_events, the whole v9 moderation inbox (reviews.status,
-- inquiries.status and their companions) and the v10 site_content table -- which
-- getContent() reads on every storefront page, so the whole site returned 500.
`;

const out = `${header}\n${read("schema.sql")}\n${read("seed-catalogue.sql")}`;
writeFileSync(join(db, "neon-setup.sql"), out);
console.log(`db/neon-setup.sql regenerated (${out.split("\n").length} lines).`);
