import "server-only";
import { revalidateTag } from "next/cache";
import { pool } from "../db";
import { requireAdmin } from "./session";

/**
 * The three inboxes: submitted reviews, product enquiries and newsletter subscribers.
 *
 * As in orders.ts and products.ts, **every exported function calls requireAdmin() before
 * it touches the pool**. See the note at the top of orders.ts for why the guard lives
 * with the data rather than on the route.
 *
 * Approving or rejecting a review calls revalidateTag("reviews"), because getReviews()
 * and the rating columns in catalog.ts are cached for hours under that tag -- without it
 * an approved review would not appear on the storefront for the rest of the day. The
 * public submission endpoint deliberately does NOT revalidate: that would let anyone
 * flush the catalogue cache in a loop.
 */

const PAGE_SIZE = 30;

export type ReviewStatus = "pending" | "approved" | "rejected";

export type PendingReview = {
  id: number;
  productSlug: string;
  productName: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  isDemo: boolean;
  createdAt: string;
  moderatedBy: string | null;
  /** How many other reviews share this submitter's hashed address — a flood signal. */
  fromSameVisitor: number;
};

export type ReviewQueue = { rows: PendingReview[]; total: number; page: number; pages: number };

export async function listReviews(
  status: ReviewStatus | "all",
  page = 1,
): Promise<ReviewQueue> {
  await requireAdmin();
  const current = Math.max(1, Math.floor(page));

  const { rows } = await pool.query(
    `SELECT r.id, p.slug AS "productSlug", p.name AS "productName",
            r.author, r.rating, r.title, r.body, r.status, r.is_demo AS "isDemo",
            to_char(r.created_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') AS "createdAt",
            NULLIF(r.moderator_name, '') AS "moderatedBy",
            -- Guarded by CASE, not COALESCE: a review submitted before ip_hash existed
            -- has a NULL hash, the inner count then matches nothing, and "count - 1"
            -- would report -1 other reviews rather than none.
            CASE WHEN r.ip_hash IS NULL THEN 0
                 ELSE (SELECT count(*)::int - 1 FROM reviews o WHERE o.ip_hash = r.ip_hash)
            END AS "fromSameVisitor",
            count(*) OVER ()::int AS "totalRows"
     FROM reviews r
     JOIN products p ON p.id = r.product_id
     WHERE ($1::text = 'all' OR r.status = $1)
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT $2 OFFSET $3`,
    [status, PAGE_SIZE, (current - 1) * PAGE_SIZE],
  );

  const total = rows[0]?.totalRows ?? 0;
  return {
    rows: rows.map((r) => ({
      id: r.id,
      productSlug: r.productSlug,
      productName: r.productName,
      author: r.author,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      isDemo: r.isDemo,
      createdAt: r.createdAt,
      moderatedBy: r.moderatedBy,
      fromSameVisitor: Math.max(0, r.fromSameVisitor),
    })),
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function reviewCounts(): Promise<Record<ReviewStatus | "all", number>> {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT count(*)::int AS all,
            count(*) FILTER (WHERE status = 'pending')::int  AS pending,
            count(*) FILTER (WHERE status = 'approved')::int AS approved,
            count(*) FILTER (WHERE status = 'rejected')::int AS rejected
     FROM reviews`,
  );
  return rows[0];
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Approve or reject one review, recording who decided. */
export async function setReviewStatus(id: number, status: ReviewStatus): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Unknown review." };
  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return { ok: false, error: "Unknown decision." };
  }

  const { rows } = await pool.query(
    `UPDATE reviews
        SET status = $2, moderated_at = now(), moderated_by = $3, moderator_name = $4
      WHERE id = $1 AND status <> $2
      RETURNING id`,
    [id, status, admin.id, admin.name],
  );
  if (!rows[0]) return { ok: false, error: `That review is already ${status}.` };

  revalidateTag("reviews", { expire: 0 });
  return { ok: true };
}

/**
 * Delete a review outright, for spam that should not even sit in the rejected list.
 * Manager only, because it destroys evidence of a flood.
 */
export async function deleteReview(id: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "manager") return { ok: false, error: "Only a manager can delete a review." };
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Unknown review." };

  const { rowCount } = await pool.query(`DELETE FROM reviews WHERE id = $1`, [id]);
  if (!rowCount) return { ok: false, error: "Unknown review." };

  revalidateTag("reviews", { expire: 0 });
  return { ok: true };
}

/** Reject every pending review that shares one submitter's hashed address. */
export async function rejectVisitorFlood(reviewId: number): Promise<ActionResult & { count?: number }> {
  const admin = await requireAdmin();
  if (!Number.isInteger(reviewId) || reviewId < 1) return { ok: false, error: "Unknown review." };

  const { rowCount } = await pool.query(
    `UPDATE reviews
        SET status = 'rejected', moderated_at = now(), moderated_by = $2, moderator_name = $3
      WHERE status = 'pending'
        AND ip_hash IS NOT NULL
        AND ip_hash = (SELECT ip_hash FROM reviews WHERE id = $1)
      RETURNING id`,
    [reviewId, admin.id, admin.name],
  );
  if (!rowCount) return { ok: false, error: "Nothing else to reject from that visitor." };

  revalidateTag("reviews", { expire: 0 });
  return { ok: true, count: rowCount };
}

// ---------------------------------------------------------------- enquiries

export type InquiryStatus = "new" | "answered" | "closed";

export type Inquiry = {
  id: number;
  productSlug: string | null;
  productName: string | null;
  name: string;
  email: string;
  message: string;
  config: Record<string, string>;
  status: InquiryStatus;
  adminNote: string;
  handledBy: string | null;
  createdAt: string;
};

export type InquiryList = { rows: Inquiry[]; total: number; page: number; pages: number };

export async function listInquiries(status: InquiryStatus | "all", page = 1): Promise<InquiryList> {
  await requireAdmin();
  const current = Math.max(1, Math.floor(page));

  const { rows } = await pool.query(
    `SELECT q.id, p.slug AS "productSlug", p.name AS "productName",
            q.name, q.email, q.message, q.config, q.status,
            q.admin_note AS "adminNote", NULLIF(q.handler_name, '') AS "handledBy",
            to_char(q.created_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY, HH24:MI') AS "createdAt",
            count(*) OVER ()::int AS "totalRows"
     FROM inquiries q
     LEFT JOIN products p ON p.id = q.product_id
     WHERE ($1::text = 'all' OR q.status = $1)
     ORDER BY q.created_at DESC, q.id DESC
     LIMIT $2 OFFSET $3`,
    [status, PAGE_SIZE, (current - 1) * PAGE_SIZE],
  );

  const total = rows[0]?.totalRows ?? 0;
  return {
    rows: rows.map((r) => ({
      id: r.id,
      productSlug: r.productSlug,
      productName: r.productName,
      name: r.name,
      email: r.email,
      message: r.message,
      config: r.config ?? {},
      status: r.status,
      adminNote: r.adminNote ?? "",
      handledBy: r.handledBy,
      createdAt: r.createdAt,
    })),
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function inquiryCounts(): Promise<Record<string, number>> {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT count(*)::int AS all,
            count(*) FILTER (WHERE status = 'new')::int      AS new,
            count(*) FILTER (WHERE status = 'answered')::int AS answered,
            count(*) FILTER (WHERE status = 'closed')::int   AS closed
     FROM inquiries`,
  );
  return rows[0];
}

export async function setInquiryStatus(
  id: number,
  status: InquiryStatus,
  note: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Unknown enquiry." };
  if (status !== "new" && status !== "answered" && status !== "closed") {
    return { ok: false, error: "Unknown status." };
  }

  const { rows } = await pool.query(
    `UPDATE inquiries
        SET status = $2,
            admin_note = CASE WHEN $5::text = '' THEN admin_note ELSE $5 END,
            handled_at = now(), handled_by = $3, handler_name = $4
      WHERE id = $1 RETURNING id`,
    [id, status, admin.id, admin.name, note.trim().slice(0, 2000)],
  );
  return rows[0] ? { ok: true } : { ok: false, error: "Unknown enquiry." };
}

// ---------------------------------------------------------------- subscribers

export type Subscriber = {
  email: string;
  confirmed: boolean;
  createdAt: string;
  confirmedAt: string | null;
  /** Present only while unconfirmed; the link to send until mail is wired up. */
  confirmToken: string | null;
};

export type SubscriberList = {
  rows: Subscriber[];
  total: number;
  confirmed: number;
  pending: number;
  page: number;
  pages: number;
};

export async function listSubscribers(
  filter: "all" | "confirmed" | "pending",
  page = 1,
): Promise<SubscriberList> {
  await requireAdmin();
  const current = Math.max(1, Math.floor(page));
  const want = filter === "all" ? null : filter === "confirmed";

  const [list, totals] = await Promise.all([
    pool.query(
      `SELECT email, confirmed, confirm_token AS "confirmToken",
              to_char(created_at   AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY') AS "createdAt",
              to_char(confirmed_at AT TIME ZONE 'Asia/Muscat', 'DD Mon YYYY') AS "confirmedAt",
              count(*) OVER ()::int AS "totalRows"
       FROM newsletter
       WHERE ($1::bool IS NULL OR confirmed = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [want, PAGE_SIZE, (current - 1) * PAGE_SIZE],
    ),
    pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE confirmed)::int     AS confirmed,
              count(*) FILTER (WHERE NOT confirmed)::int AS pending
       FROM newsletter`,
    ),
  ]);

  const total = list.rows[0]?.totalRows ?? 0;
  return {
    rows: list.rows.map((r) => ({
      email: r.email,
      confirmed: r.confirmed,
      createdAt: r.createdAt,
      confirmedAt: r.confirmedAt,
      confirmToken: r.confirmToken,
    })),
    total,
    confirmed: totals.rows[0].confirmed,
    pending: totals.rows[0].pending,
    page: current,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/**
 * Confirm a subscriber by hand.
 *
 * Needed because nothing sends the confirmation email yet: without it a sign-up could
 * never be completed. It clears the token, so the emailed link (once mail exists) cannot
 * also be used afterwards.
 */
export async function confirmSubscriber(email: string): Promise<ActionResult> {
  await requireAdmin();
  const address = email.trim().toLowerCase();
  if (!address || address.length > 200) return { ok: false, error: "Unknown address." };

  const { rows } = await pool.query(
    `UPDATE newsletter SET confirmed = true, confirmed_at = now(), confirm_token = NULL
      WHERE email = $1 AND NOT confirmed RETURNING email`,
    [address],
  );
  return rows[0] ? { ok: true } : { ok: false, error: "That address is already confirmed." };
}

/** Remove a subscriber entirely, for an unsubscribe request or an obvious fake. */
export async function deleteSubscriber(email: string): Promise<ActionResult> {
  await requireAdmin();
  const address = email.trim().toLowerCase();
  if (!address) return { ok: false, error: "Unknown address." };

  const { rowCount } = await pool.query(`DELETE FROM newsletter WHERE email = $1`, [address]);
  return rowCount ? { ok: true } : { ok: false, error: "Unknown address." };
}
