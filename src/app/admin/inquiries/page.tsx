import Link from "next/link";
import { inquiryCounts, listInquiries, type InquiryStatus } from "@/lib/admin/moderation";
import { updateInquiryAction } from "../actions";

export const metadata = { title: "Enquiries", robots: { index: false, follow: false } };

const TABS: { key: InquiryStatus | "all"; label: string }[] = [
  { key: "new", label: "New" },
  { key: "answered", label: "Answered" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "Everything" },
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The materials the customer had chosen in the configurator, if any. */
function chosen(config: Record<string, string>) {
  const picked = Object.entries(config).filter(([, v]) => v);
  return picked.length ? picked.map(([k, v]) => `${k}: ${v}`).join(" · ") : null;
}

export default async function InquiriesPage({ searchParams }: PageProps<"/admin/inquiries">) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === one(sp.status))?.key ?? "new") as InquiryStatus | "all";
  const page = Number(one(sp.page) ?? 1) || 1;
  const error = one(sp.error);

  const [list, counts] = await Promise.all([listInquiries(tab, page), inquiryCounts()]);
  const here = `/admin/inquiries?status=${tab}${page > 1 ? `&page=${page}` : ""}`;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Enquiries</h1>
          <p className="adm-sub">
            {counts.new > 0
              ? `${counts.new} new quote request${counts.new === 1 ? "" : "s"} from the product pages.`
              : "No new quote requests."}
          </p>
        </div>
      </div>

      {error && <p className="adm-notice" role="alert">{error}</p>}

      <div className="adm-filters">
        <div className="adm-chips">
          {TABS.map((t) => (
            <Link key={t.key} href={`/admin/inquiries?status=${t.key}`} className={`adm-chip ${tab === t.key ? "on" : ""}`}>
              {t.label}
              <small>{counts[t.key] ?? 0}</small>
            </Link>
          ))}
        </div>
      </div>

      {list.rows.length === 0 ? (
        <p className="adm-empty">No enquiries here.</p>
      ) : (
        <div className="adm-stack">
          {list.rows.map((q) => {
            const picked = chosen(q.config);
            return (
              <article key={q.id} className="adm-card adm-pad">
                <div className="adm-review-head">
                  <div>
                    <h2 dir="auto">{q.name}</h2>
                    <p className="adm-stat-note">
                      <a href={`mailto:${q.email}`}>{q.email}</a> · {q.createdAt}
                      {q.productSlug && (
                        <>
                          {" · "}
                          <Link href={`/product/${q.productSlug}`} className="adm-row-link" dir="auto">
                            {q.productName}
                          </Link>
                        </>
                      )}
                      {q.handledBy && <> · handled by {q.handledBy}</>}
                    </p>
                  </div>
                  <span className="adm-badge" data-status={q.status === "closed" ? "delivered" : q.status === "answered" ? "confirmed" : "placed"}>
                    {q.status === "new" ? "New" : q.status === "answered" ? "Answered" : "Closed"}
                  </span>
                </div>

                {q.message ? (
                  <p className="adm-review-body" dir="auto">{q.message}</p>
                ) : (
                  <p className="adm-stat-note">No message — just a request to be contacted.</p>
                )}
                {picked && <p className="adm-stat-note">Chose — {picked}</p>}
                {q.adminNote && <p className="adm-note">Your note: {q.adminNote}</p>}

                {/* One form: the note and the new status are saved together, so a reply
                    is always recorded with the reason it was closed. */}
                <form action={updateInquiryAction} className="adm-inquiry-form">
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="back" value={here} />
                  <label className="adm-field">
                    <span>Internal note (optional)</span>
                    <input name="note" defaultValue="" maxLength={2000} placeholder="e.g. called, quoted OMR 520" />
                  </label>
                  <div className="adm-actions">
                    {q.status !== "answered" && (
                      <button type="submit" name="status" value="answered" className="adm-btn adm-btn-primary">
                        Mark answered
                      </button>
                    )}
                    {q.status !== "closed" && (
                      <button type="submit" name="status" value="closed" className="adm-btn">
                        Close
                      </button>
                    )}
                    {q.status !== "new" && (
                      <button type="submit" name="status" value="new" className="adm-btn adm-btn-quiet">
                        Reopen
                      </button>
                    )}
                  </div>
                </form>
              </article>
            );
          })}
        </div>
      )}

      {list.pages > 1 && (
        <nav className="adm-pager" aria-label="Pages">
          {list.page > 1 && (
            <Link className="adm-btn" href={`/admin/inquiries?status=${tab}&page=${list.page - 1}`}>← Previous</Link>
          )}
          <span>Page {list.page} of {list.pages}</span>
          {list.page < list.pages && (
            <Link className="adm-btn" href={`/admin/inquiries?status=${tab}&page=${list.page + 1}`}>Next →</Link>
          )}
        </nav>
      )}
    </>
  );
}
