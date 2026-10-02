import { redirect } from "next/navigation";

// The Outreach page moved into /app/acquisitions as the Agent Outreach tab
// (consolidation, Randy Oct 2026). Its components in this folder are
// unchanged and rendered from there. Geoffrey's Desk links here; the
// redirect keeps that working until he points it at the tab.
export default function OutreachPage() {
  redirect("/app/acquisitions?tab=outreach");
}
