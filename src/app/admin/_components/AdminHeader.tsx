import Link from "next/link";
import { currentAdmin } from "@/lib/admin/session";
import { signOutAction } from "../actions";

/**
 * Deliberately currentAdmin() and not requireAdmin(): the login page renders inside this
 * same layout, and redirecting from here when nobody is signed in would send /admin/login
 * to itself in a loop.
 */
export async function AdminHeader() {
  const admin = await currentAdmin();
  return (
    <header className="adm-bar">
      <Link href={admin ? "/admin" : "/admin/login"} className="adm-brand">
        Muscat Furniture <span>Back office</span>
      </Link>
      {admin && (
        <div className="adm-bar-right">
          <nav className="adm-nav" aria-label="Back office">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/orders">Orders</Link>
            <Link href="/admin/customers">Customers</Link>
            <Link href="/admin/products">Products</Link>
            <Link href="/admin/content">Content</Link>
            <Link href="/admin/reviews">Reviews</Link>
            <Link href="/admin/inquiries">Enquiries</Link>
            <Link href="/admin/subscribers">Newsletter</Link>
            <Link href="/admin/showrooms">Showrooms</Link>
          </nav>
          <span className="adm-who" title={admin.email}>
            {admin.name}
          </span>
          <form action={signOutAction}>
            <button type="submit" className="adm-btn adm-btn-quiet">
              Sign out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
