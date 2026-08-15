import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

// Public marketing routes only; the internal app lives behind auth.
// Added for handoff 003 (the /signal ads launch needs the page in a
// sitemap); expanded in audit 001 to the full public surface.
//
// Deliberately absent, each for its own reason:
//   /active-deals-*       secret slug; listing it would republish the URL
//   /compare/*            noindex by design (obfuscated client-share slug)
//   /deals/html/*         raw-HTML variant of the same listing content
//   /login, /auth/error   utility pages with no search value
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://btinvestments.co";

  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/signal`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/signal/faq`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/join-buyers-list`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/sell-property`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/where-we-buy`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/hello`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/infinite-media`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/infinite-media/menu`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/infinite-media/portfolio`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/infinite-media/contact`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/infinite-re`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/infinite-re/portfolio`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/infinite-re/contact`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Live deal pages. A DB hiccup must degrade to the fixed list, never
  // 500 the sitemap - crawlers treat a failing sitemap as a broken site.
  let deals: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("listing_pages")
      .select("slug")
      .eq("page_type", "webpage")
      .eq("is_active", true);
    deals = (data ?? []).map((row) => ({
      url: `${base}/deals/${row.slug as string}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // fixed list still ships
  }

  return [...fixed, ...deals];
}
