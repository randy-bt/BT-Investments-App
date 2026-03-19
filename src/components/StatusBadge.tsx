import type { EntityStatus } from "@/lib/types";

const styles: Record<EntityStatus, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  closed: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

export function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
