/**
 * The order fulfilment workflow. Imported by both server code and client components, so
 * this file stays free of "server-only" and of any database import.
 *
 * Until now orders.status defaulted to 'awaiting_payment' and was never read or written.
 * That name never fitted cash on delivery, where the money arrives at handover, so the
 * states below describe what staff actually do.
 */

export const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "dispatched",
  "delivered",
  "cancelled",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const isOrderStatus = (value: string): value is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(value);

/** The only moves allowed from each state. Enforced on the server, not just in the UI. */
export const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["dispatched", "cancelled"],
  dispatched: ["delivered", "cancelled"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  NEXT_STATUSES[from].includes(to);

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  dispatched: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/** What the staff member is being asked to do next, shown on the action buttons. */
export const TRANSITION_LABEL: Record<OrderStatus, string> = {
  placed: "Mark as placed",
  confirmed: "Confirm by phone",
  dispatched: "Send out for delivery",
  delivered: "Mark delivered (cash taken)",
  cancelled: "Cancel order",
  returned: "Mark returned",
};
