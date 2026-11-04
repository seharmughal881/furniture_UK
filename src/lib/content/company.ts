import "server-only";
import { COMPANY, type Company } from "../company";
import { getContent } from "./read";

/**
 * The business details as saved in the back office, falling back to the constants in
 * lib/company.ts.
 *
 * In its own server-only module, NOT in lib/company.ts, and that separation matters:
 * company.ts exports whatsappLink(), which client components (Nav, CartDrawer,
 * CardActions, ProductExperience) all import. Putting a database read in that file pulls
 * "server-only", the pg pool and a "use cache" function into the browser bundle, and the
 * build fails with "Module not found: Can't resolve 'dns'". Keep company.ts pure.
 */
export async function getCompany(): Promise<Company> {
  const saved = await getContent<Partial<Company>>("company");
  const merged = { ...COMPANY, ...saved };
  // isPlaceholder stays computed rather than stored: it is true only while the bracketed
  // defaults are still there, so the footer's warning disappears by itself once the owner
  // fills in the real registration numbers.
  return {
    ...merged,
    isPlaceholder:
      /^\[/.test(merged.legalName) || /^\[/.test(merged.crNumber) || /^\[/.test(merged.vatNumber),
  };
}
