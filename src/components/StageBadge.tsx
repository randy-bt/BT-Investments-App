import type { LeadStage } from "@/lib/types";

const labels: Record<LeadStage, string> = {
  follow_up: "Follow Up",
  lead: "Lead",
  marketing_on_hold: "Marketing On Hold",
  marketing_active: "Marketing Active",
  assigned_in_escrow: "Assigned / In Escrow",
};

const styles: Record<LeadStage, string> = {
  follow_up: "bg-yellow-50 text-yellow-700 border-yellow-200",
  lead: "bg-blue-50 text-blue-700 border-blue-200",
  marketing_on_hold: "bg-orange-50 text-orange-700 border-orange-200",
  marketing_active: "bg-purple-50 text-purple-700 border-purple-200",
  assigned_in_escrow: "bg-green-50 text-green-700 border-green-200",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${styles[stage]}`}
    >
      {labels[stage]}
    </span>
  );
}
