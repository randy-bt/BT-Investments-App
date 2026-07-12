import type { MetadataRoute } from "next";

// Public marketing routes only; the internal app lives behind auth.
// Added for handoff 003 (the /signal ads launch needs the page in a
// sitemap); the rest of the public site rides along.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://btinvestments.co";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/signal`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/signal/faq`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/join-buyers-list`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/sell-property`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/where-we-buy`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
