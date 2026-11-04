import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/session";
import { signInAction } from "../actions";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const error = one(sp.error);
  const next = one(sp.next) ?? "";

  // Already signed in: skip the form.
  if (await currentAdmin()) redirect(next.startsWith("/admin") ? next : "/admin/orders");

  return (
    <div className="adm-login">
      <h1>Sign in</h1>
      <p className="adm-sub">Muscat Furniture back office. Staff accounts only.</p>

      {error && (
        <p className="adm-notice" role="alert" style={{ marginTop: 18 }}>
          {error}
        </p>
      )}

      <form action={signInAction}>
        <input type="hidden" name="next" value={next} />
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="adm-btn adm-btn-primary" type="submit">
          Sign in
        </button>
      </form>

      <p className="adm-sub" style={{ marginTop: 20 }}>
        No account? There is no sign-up — ask whoever runs the site to create one with{" "}
        <code>npm run admin:create</code>.
      </p>
    </div>
  );
}
