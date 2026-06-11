import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { getMatchCountsForListingPages, type MatchCounts } from "@/actions/deal-sends";
import { ActivePagesTable } from "./client";
import type { ListingPage } from "@/lib/types";

export const dynamic = "force-dynamic";

export type ActiveListingPageWithLead = ListingPage & {
  leads: { name: string } | null;
};

export default async function ListingPageCreatorPage() {
  let pages: ActiveListingPageWithLead[] = [];
  let archivedPages: (ActiveListingPageWithLead)[] = [];
  let counts: Record<string, MatchCounts> = {};
  try {
    const user = await getAuthUser();
    requireAuth(user);
    const supabase = await createServerClient();
    const { data: activeData } = await supabase
      .from("listing_pages")
      .select("*, leads(name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    pages = (activeData ?? []) as ActiveListingPageWithLead[];

    const { data: archivedData } = await supabase
      .from("listing_pages")
      .select("*, leads(name)")
      .eq("is_active", false)
      .order("created_at", { ascending: false });
    archivedPages = (archivedData ?? []) as ActiveListingPageWithLead[];

    const activeIds = pages.map((p) => p.id);
    const countsResult = await getMatchCountsForListingPages(activeIds);
    counts = countsResult.success ? countsResult.data : {};
  } catch {
    pages = [];
    archivedPages = [];
    counts = {};
  }

  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 w-full max-w-3xl py-10">
        <header className="w-full border-b border-dashed border-neutral-300 pb-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Marketing Pages</h1>
          <p className="text-sm text-neutral-600">
            Generate property marketing pages
          </p>
        </header>

        <section className="grid w-full gap-4">
          <MenuCard
            href="/app/marketing-page-creator/create"
            title="Create Marketing Page"
            description="Fill in the property and generate a webpage or HTML"
            variant="primary"
          />
        </section>

        <section className="w-full rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">
            Active Pages
          </h2>
          <ActivePagesTable initialPages={pages} archivedPages={archivedPages} counts={counts} />
        </section>
      </div>
    </main>
  );
}

function MenuCard({
  href,
  title,
  description,
  variant = "default",
}: {
  href: string;
  title: string;
  description: string;
  variant?: "default" | "primary";
}) {
  const base =
    "block rounded-lg border border-dashed p-5 shadow-sm transition hover:shadow-md";
  const styles =
    variant === "primary"
      ? "border-[#c5cca8] bg-[#e8edda] hover:bg-[#dce3cb] hover:border-[#b5bd94]"
      : "border-neutral-300 bg-white hover:border-neutral-400";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      <h2 className="text-sm font-medium text-neutral-800">{title}</h2>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </Link>
  );
}
