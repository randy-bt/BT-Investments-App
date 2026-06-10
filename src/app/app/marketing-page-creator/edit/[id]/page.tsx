import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { getLeads } from "@/actions/leads";
import { CreateListingPageClient } from "../../create/client";
import type { ListingPage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditListingPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getAuthUser();
  requireAuth(user);

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("listing_pages")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const page = data as ListingPage;

  const leadsResult = await getLeads({ page: 1, pageSize: 500, status: "active" });
  const leads = leadsResult.success ? leadsResult.data.items : [];

  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6">
      <div className="flex flex-1 flex-col items-center gap-6 w-full max-w-5xl py-10">
        <header className="w-full border-b border-dashed border-neutral-300 pb-4">
          <Link
            href="/app/marketing-page-creator"
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            ← Back to Marketing Pages
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Edit Marketing Page
          </h1>
          <p className="text-sm text-neutral-600">
            Updating <code className="font-mono">{page.slug}</code> — changes go live immediately.
          </p>
        </header>

        <CreateListingPageClient
          leads={leads}
          existingPage={{
            id: page.id,
            slug: page.slug,
            address: page.address,
            inputs: page.inputs as Record<string, unknown>,
          }}
        />
      </div>
    </main>
  );
}
