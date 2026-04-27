import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { HtmlViewerClient } from "./viewer-client";

export const dynamic = "force-dynamic";

export default async function DealHtmlPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("listing_pages")
    .select("address, html_content")
    .eq("slug", slug)
    .eq("page_type", "html")
    .eq("is_active", true)
    .single();

  if (error || !data) notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="border-b border-dashed border-neutral-300 pb-3">
        <h1 className="text-base font-medium text-neutral-800">{data.address}</h1>
      </header>
      <HtmlViewerClient html={data.html_content as string} />
    </main>
  );
}
