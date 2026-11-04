import Link from "next/link";
import { listSubscribers } from "@/lib/admin/moderation";
import { subscriberAction } from "../actions";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";

export const metadata = { title: "Subscribers", robots: { index: false, follow: false } };

const TABS = [
  { key: "confirmed", label: "Confirmed" },
  { key: "pending", label: "Not confirmed" },
  { key: "all", label: "Everyone" },
] as const;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SubscribersPage({ searchParams }: PageProps<"/admin/subscribers">) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === one(sp.filter))?.key ?? "confirmed") as
    | "all"
    | "confirmed"
    | "pending";
  const page = Number(one(sp.page) ?? 1) || 1;
  const error = one(sp.error);

  const list = await listSubscribers(tab, page);
  const here = `/admin/subscribers?filter=${tab}${page > 1 ? `&page=${page}` : ""}`;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Newsletter</h1>
          <p className="adm-sub">
            {list.confirmed} confirmed · {list.pending} waiting to confirm
          </p>
        </div>
      </div>

      {error && <p className="adm-notice" role="alert">{error}</p>}

      <p className="adm-note">
        Only send to <strong>confirmed</strong> addresses. Anyone can type any address into the sign-up box,
        so an unconfirmed row is not proof that its owner asked to hear from you.
      </p>

      <div className="adm-filters">
        <div className="adm-chips">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/subscribers?filter=${t.key}`}
              className={`adm-chip ${tab === t.key ? "on" : ""}`}
            >
              {t.label}
              <small>{t.key === "confirmed" ? list.confirmed : t.key === "pending" ? list.pending : list.total}</small>
            </Link>
          ))}
        </div>
      </div>

      <div className="adm-table-wrap">
        {list.rows.length === 0 ? (
          <p className="adm-empty">Nobody here yet.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Signed up</th>
                <th>Confirmed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((s) => (
                <tr key={s.email}>
                  <td>
                    <a href={`mailto:${s.email}`}>{s.email}</a>
                  </td>
                  <td>{s.createdAt}</td>
                  <td>
                    {s.confirmed ? (
                      <span className="adm-badge" data-status="delivered">
                        {s.confirmedAt ?? "yes"}
                      </span>
                    ) : (
                      <span className="adm-badge" data-status="placed">
                        Waiting
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="adm-actions">
                      {!s.confirmed && (
                        <form action={subscriberAction}>
                          <input type="hidden" name="email" value={s.email} />
                          <input type="hidden" name="what" value="confirm" />
                          <input type="hidden" name="back" value={here} />
                          <button type="submit" className="adm-btn">
                            Confirm by hand
                          </button>
                        </form>
                      )}
                      <form action={subscriberAction}>
                        <input type="hidden" name="email" value={s.email} />
                        <input type="hidden" name="what" value="delete" />
                        <input type="hidden" name="back" value={here} />
                        <ConfirmSubmit
                          label="Remove"
                          confirmLabel="Yes, remove"
                          question="Remove this subscriber?"
                          className="adm-btn adm-btn-quiet"
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="adm-stat-note">
        No confirmation emails are sent yet — the site has no mail provider. Until one is added, use
        “Confirm by hand” after checking with the person, rather than assuming.
      </p>

      {list.pages > 1 && (
        <nav className="adm-pager" aria-label="Pages">
          {list.page > 1 && (
            <Link className="adm-btn" href={`/admin/subscribers?filter=${tab}&page=${list.page - 1}`}>
              ← Previous
            </Link>
          )}
          <span>
            Page {list.page} of {list.pages}
          </span>
          {list.page < list.pages && (
            <Link className="adm-btn" href={`/admin/subscribers?filter=${tab}&page=${list.page + 1}`}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
