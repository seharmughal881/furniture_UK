import Link from "next/link";
import { listReviews, reviewCounts, type ReviewStatus } from "@/lib/admin/moderation";
import { currentAdmin } from "@/lib/admin/session";
import { Stars } from "@/components/product/Stars";
import { moderateReviewAction } from "../actions";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";

export const metadata = { title: "Reviews", robots: { index: false, follow: false } };

const TABS: { key: ReviewStatus | "all"; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Published" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "Everything" },
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === one(sp.status))?.key ?? "pending") as ReviewStatus | "all";
  const page = Number(one(sp.page) ?? 1) || 1;
  const error = one(sp.error);
  const notice = one(sp.notice);

  const [admin, queue, counts] = await Promise.all([currentAdmin(), listReviews(tab, page), reviewCounts()]);
  const isManager = admin?.role === "manager";
  const here = `/admin/reviews?status=${tab}${page > 1 ? `&page=${page}` : ""}`;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Reviews</h1>
          <p className="adm-sub">
            {counts.pending > 0
              ? `${counts.pending} waiting to be read — nothing appears on the website until you approve it.`
              : "Nothing waiting. New reviews appear here before they go live."}
          </p>
        </div>
      </div>

      {error && <p className="adm-notice" role="alert">{error}</p>}
      {notice && <p className="adm-note" role="status">{notice}</p>}

      <div className="adm-filters">
        <div className="adm-chips">
          {TABS.map((t) => (
            <Link key={t.key} href={`/admin/reviews?status=${t.key}`} className={`adm-chip ${tab === t.key ? "on" : ""}`}>
              {t.label}
              <small>{counts[t.key] ?? 0}</small>
            </Link>
          ))}
        </div>
      </div>

      {queue.rows.length === 0 ? (
        <p className="adm-empty">No reviews here.</p>
      ) : (
        <div className="adm-stack">
          {queue.rows.map((r) => (
            <article key={r.id} className="adm-card adm-pad adm-review">
              <div className="adm-review-head">
                <div>
                  <Stars rating={r.rating} count={1} />
                  <h2 dir="auto">{r.title}</h2>
                  <p className="adm-stat-note">
                    {r.author} · {r.createdAt} ·{" "}
                    <Link href={`/product/${r.productSlug}`} className="adm-row-link" dir="auto">
                      {r.productName}
                    </Link>
                    {r.moderatedBy && <> · decided by {r.moderatedBy}</>}
                  </p>
                </div>
                <span className="adm-badge" data-status={r.status === "approved" ? "delivered" : r.status === "rejected" ? "cancelled" : "placed"}>
                  {r.status === "approved" ? "Published" : r.status === "rejected" ? "Rejected" : "Waiting"}
                </span>
              </div>

              <p className="adm-review-body" dir="auto">{r.body}</p>

              {r.fromSameVisitor > 0 && (
                <p className="adm-notice">
                  {r.fromSameVisitor} other review{r.fromSameVisitor === 1 ? "" : "s"} came from the same visitor.
                </p>
              )}

              <div className="adm-actions">
                {r.status !== "approved" && (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <input type="hidden" name="back" value={here} />
                    <button type="submit" className="adm-btn adm-btn-primary">Publish</button>
                  </form>
                )}
                {r.status !== "rejected" && (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <input type="hidden" name="back" value={here} />
                    <button type="submit" className="adm-btn">Reject</button>
                  </form>
                )}
                {r.status === "approved" && (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="pending" />
                    <input type="hidden" name="back" value={here} />
                    <button type="submit" className="adm-btn adm-btn-quiet">Unpublish</button>
                  </form>
                )}
                {r.fromSameVisitor > 0 && (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="flood" />
                    <input type="hidden" name="back" value={here} />
                    <button type="submit" className="adm-btn">Reject all from this visitor</button>
                  </form>
                )}
                {isManager && (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="delete" />
                    <input type="hidden" name="back" value={here} />
                    <ConfirmSubmit label="Delete" confirmLabel="Yes, delete" question="Delete this review for good?" />
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {queue.pages > 1 && (
        <nav className="adm-pager" aria-label="Pages">
          {queue.page > 1 && (
            <Link className="adm-btn" href={`/admin/reviews?status=${tab}&page=${queue.page - 1}`}>← Previous</Link>
          )}
          <span>Page {queue.page} of {queue.pages}</span>
          {queue.page < queue.pages && (
            <Link className="adm-btn" href={`/admin/reviews?status=${tab}&page=${queue.page + 1}`}>Next →</Link>
          )}
        </nav>
      )}
    </>
  );
}
