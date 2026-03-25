import type { EntityStatus } from "@/lib/types";

const styles: Record<EntityStatus, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  closed: "bg-neutral-100 text-neutral-500 border-neutral-200",
  inactive: "bg-amber-50 text-amber-700 border-amber-200",
  onboarding: "bg-blue-50 text-blue-700 border-blue-200",
  archived: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

export function StatusBadge({ status, small }: { status: EntityStatus; small?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border font-medium ${
        small ? "px-1.5 py-px text-[0.6rem]" : "px-2 py-0.5 text-xs"
      } ${styles[status]}`}
    >
      {status}
    </span>
  );
}
