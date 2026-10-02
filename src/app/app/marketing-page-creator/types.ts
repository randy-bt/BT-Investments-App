import type { ListingPage } from "@/lib/types";

// Lives in its own module rather than page.tsx so client components can
// import the type WITHOUT pulling a route's page module into the client
// bundle - doing that broke next/font's loader across the whole build
// (v9.45.0 first attempt: "next/font/google queries have exactly one entry",
// 30 times).
export type ActiveListingPageWithLead = ListingPage & {
  leads: { name: string } | null;
};
