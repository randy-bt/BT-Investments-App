import { notFound } from "next/navigation";
import { AppBackLink } from "@/components/AppBackLink";
import { getInvestor } from "@/actions/investors";
import { getUpdates } from "@/actions/updates";
import { markEntityViewed } from "@/actions/entity-views";
import { StatusBadge } from "@/components/StatusBadge";
import { InvestorRecordClient } from "./client";

export default async function InvestorRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [investorResult, updatesResult] = await Promise.all([
    getInvestor(id),
    getUpdates("investor", id),
    markEntityViewed("investor", id),
  ]);

  if (!investorResult.success) notFound();
  const investor = investorResult.data;
  const updates = updatesResult.success ? updatesResult.data.items : [];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Investor Record
          </h1>
          {investor.status === "archived" && <StatusBadge status="archived" />}
        </div>
        <AppBackLink href="/app/dispositions" />
      </header>

      <InvestorRecordClient investor={investor} updates={updates} />
    </main>
  );
}
