import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { listJvDeals } from "@/actions/jv-deals";
import { JvInboxClient } from "./client";

export const dynamic = "force-dynamic";

export default async function JvsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/app");
  const result = await listJvDeals();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4 dark:border-neutral-700">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">JVs</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Inbound JV / wholesale deals</p>
        </div>
      </header>
      {result.success ? (
        <JvInboxClient initialActive={result.data.active} initialArchived={result.data.archived} />
      ) : (
        <p className="text-sm text-red-600">Error loading JV deals: {result.error}</p>
      )}
    </main>
  );
}
