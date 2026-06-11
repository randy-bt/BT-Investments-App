import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MigrateLocationsClient } from "./client";

export const dynamic = "force-dynamic";

export type UnmigratedInvestor = {
  id: string;
  name: string;
  company: string | null;
  locations_of_interest: string | null;
  unlinked_names: string[];
};

export default async function MigrateLocationsPage() {
  const user = await getAuthUser();
  try {
    requireAdmin(user);
  } catch {
    redirect("/app");
  }

  const supabase = await createServerClient();

  const { data: investors } = await supabase
    .from("investors")
    .select("id, name, company, locations_of_interest, investor_locations(id, location_id, location_name)")
    .order("name", { ascending: true });

  const unmigrated: UnmigratedInvestor[] = ((investors ?? []) as Array<{
    id: string;
    name: string;
    company: string | null;
    locations_of_interest: string | null;
    investor_locations: Array<{ id: string; location_id: string | null; location_name: string | null }>;
  }>)
    .map((inv) => {
      const unlinked = inv.investor_locations
        .filter((il) => il.location_id === null && il.location_name)
        .map((il) => il.location_name as string);
      // Also surface investors who have free-text but no rows at all
      if (unlinked.length === 0 && inv.investor_locations.length === 0 && inv.locations_of_interest) {
        const parts = inv.locations_of_interest.split(/[;,]+/).map((s) => s.trim()).filter(Boolean);
        return { id: inv.id, name: inv.name, company: inv.company, locations_of_interest: inv.locations_of_interest, unlinked_names: parts };
      }
      return { id: inv.id, name: inv.name, company: inv.company, locations_of_interest: inv.locations_of_interest, unlinked_names: unlinked };
    })
    .filter((row) => row.unlinked_names.length > 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Migrate Locations ({unmigrated.length} left)
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Map free-text location strings to structured locations. Click a suggestion to add it; create a new location if none match.
        </p>
      </header>

      <MigrateLocationsClient investors={unmigrated} />
    </main>
  );
}
