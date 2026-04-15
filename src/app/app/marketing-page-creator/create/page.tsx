import { AppBackLink } from "@/components/AppBackLink";
import { getLeads } from "@/actions/leads";
import { CreateListingPageClient } from "./client";

export default async function CreateListingPage() {
  const result = await getLeads({ page: 1, pageSize: 500, status: "active" });
  const leads = result.success ? result.data.items : [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Create Marketing Page
          </h1>
          <p className="text-sm text-neutral-600">
            Fill in the details and generate the HTML
          </p>
        </div>
        <AppBackLink href="/app/marketing-page-creator" />
      </header>

      <CreateListingPageClient leads={leads} />
    </main>
  );
}
