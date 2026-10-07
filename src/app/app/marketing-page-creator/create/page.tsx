import { AppBackLink } from "@/components/AppBackLink";
import { getLeads } from "@/actions/leads";
import { getJvDeal } from "@/actions/jv-deals";
import { createServerClient } from "@/lib/supabase/server";
import { jvPartnerCompany, partnerKeyMap, type PartnerRecord } from "@/lib/dispo/deal-names";
import { jvPagePrefill, type JvPagePrefill } from "@/lib/dispo/jv-prefill";
import { CreateListingPageClient } from "./client";

export const dynamic = "force-dynamic";

export default async function CreateListingPage({
  searchParams,
}: {
  searchParams: Promise<{ jv?: string }>;
}) {
  const { jv } = await searchParams;
  const result = await getLeads({ page: 1, pageSize: 500, status: "active" });
  const leads = result.success ? result.data.items : [];

  // "Build page" from the Dispositions Deals tab (Randy's flow, Oct 7
  // 2026): the same creator, prefilled from the JV deal, and the saved page
  // attaches to the deal instead of a lead.
  let jvDeal: JvPagePrefill | null = null;
  if (jv) {
    const deal = await getJvDeal(jv);
    if (deal.success) {
      let partner: string | null = null;
      try {
        const supabase = await createServerClient();
        const { data: partners } = await supabase.from("investors").select("name, company");
        partner = jvPartnerCompany(deal.data.source_name, partnerKeyMap((partners ?? []) as PartnerRecord[]));
      } catch {
        /* the banner just omits the company */
      }
      jvDeal = jvPagePrefill(deal.data, partner);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Create Marketing Page
          </h1>
          <p className="text-sm text-neutral-600">
            {jvDeal ? "For a JV deal: fill in the details and generate the page" : "Fill in the details and generate the HTML"}
          </p>
        </div>
        <AppBackLink href={jvDeal ? "/app/dispositions?tab=deals" : "/app/marketing-page-creator"} />
      </header>

      <CreateListingPageClient leads={leads} jvDeal={jvDeal} />
    </main>
  );
}
