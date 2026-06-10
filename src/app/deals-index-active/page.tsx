import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PHOTOS_BUCKET = "listing-page-photos";

export const metadata: Metadata = {
  title: "BT Investments — Active Deals",
  description: "Browse current real estate investment opportunities from BT Investments.",
};

type IndexRow = {
  slug: string;
  address: string;
  page_type: string;
  inputs: Record<string, unknown> | null;
  created_at: string;
};

function pickPhotoPath(inputs: Record<string, unknown> | null): string | null {
  if (!inputs) return null;
  const hero = (inputs as { heroPhotoPath?: string }).heroPhotoPath;
  if (typeof hero === "string" && hero.length > 0) return hero;
  const front = (inputs as { frontPhotoPath?: string }).frontPhotoPath;
  if (typeof front === "string" && front.length > 0) return front;
  return null;
}

function pickPrice(inputs: Record<string, unknown> | null): string | null {
  if (!inputs) return null;
  const price = (inputs as { price?: string }).price;
  return typeof price === "string" && price.length > 0 ? price : null;
}

export default async function DealsIndexActivePage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("listing_pages")
    .select("slug, address, page_type, inputs, created_at")
    .eq("is_active", true)
    .eq("show_on_index", true)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as IndexRow[];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 px-4 py-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          BT Investments — Active Deals
        </h1>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No active deals right now. Check back soon.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
            {rows.map((row) => (
              <DealCard key={row.slug} row={row} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function DealCard({ row }: { row: IndexRow }) {
  const photoPath = pickPhotoPath(row.inputs);
  const price = pickPrice(row.inputs);

  let photoUrl: string | null = null;
  if (photoPath) {
    const admin = createAdminClient();
    photoUrl = admin.storage.from(PHOTOS_BUCKET).getPublicUrl(photoPath).data.publicUrl;
  }

  const href = `/deals/${row.slug}`;

  return (
    <li className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={href} className="block">
        <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-100">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={row.address}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
              No photo
            </div>
          )}
        </div>
        <div className="px-4 py-3">
          {price && (
            <p className="text-base font-semibold text-neutral-900 sm:text-lg">{price}</p>
          )}
          <p className="mt-1 text-xs text-neutral-600 sm:text-sm">{row.address}</p>
        </div>
      </Link>
    </li>
  );
}
