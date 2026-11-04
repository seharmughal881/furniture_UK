import { STATUS_LABEL, type OrderStatus } from "@/lib/admin/status";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="adm-badge" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}
