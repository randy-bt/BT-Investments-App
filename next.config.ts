import type { NextConfig } from "next";

// Security headers (audit 001: only HSTS was present, which Vercel sets).
//
// The CSP shipped REPORT-ONLY first (v8.4.0) and moved to ENFORCING in
// v9.13.0 after the soak came back clean: public site verified in a real
// browser (map, Street View workers, Meta pixel, Signal fonts, forms),
// zero violations logged. The app side renders untrusted outside content
// (wholesaler emails, public form submissions), which is exactly what a
// CSP backstops. Do not add origins here without a reason you can write
// down; rollback is appending "-Report-Only" to the header key.
const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' is required by the theme bootstrap script, the JSON-LD
  // blocks, and Next's own inline runtime. connect.facebook.net is the
  // Meta pixel (Signal); maps.googleapis.com is the Maps JS loader.
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Maps tiles and Street View come from *.googleapis.com / *.gstatic.com /
  // *.ggpht.com; listing photos from Supabase storage; the pixel confirms
  // via an image beacon to facebook.com.
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com https://xgwmvdizqnvrswsdsljh.supabase.co https://www.facebook.com",
  "connect-src 'self' https://maps.googleapis.com https://xgwmvdizqnvrswsdsljh.supabase.co wss://xgwmvdizqnvrswsdsljh.supabase.co https://vitals.vercel-insights.com https://www.facebook.com",
  // The Maps JS API spins up its renderer in blob: workers.
  "worker-src 'self' blob:",
  // Call-recording playback: signed URLs from Supabase storage, plus the
  // blob: preview the in-app recorder plays before upload. This directive
  // was MISSING at the v9.13.0 flip - audio fell back to default-src
  // 'self' and Aldo could not play any lead recording (summarize kept
  // working because the SERVER fetches audio; CSP only governs browsers).
  "media-src 'self' blob: https://xgwmvdizqnvrswsdsljh.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone stays available to our own pages: the internal call
  // recorder and Signal voice notes both record audio.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  // ENFORCING since v9.13.0 (Randy's call, 8/16, after the report-only
  // soak came back clean on the public site incl. the map and pixel).
  // Rollback = append "-Report-Only" to the key, one line.
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Client proposals are served as static HTML from public/proposals, so each
  // document stays byte-identical to the version that was signed off (handoff
  // 016). This hides the extension: /proposals/<slug> -> /proposals/<slug>.html.
  // Future proposals are a file drop into public/proposals; no config change.
  // The Infinite Media site moved from /infinite-media to /infinitemedia
  // (Randy, Aug 2026: no dash). The old path is kept alive permanently as a
  // 308 rather than deleted, because it was live, linked from /hello, and in
  // the sitemap, so it is in Google's index and in anyone's shared links.
  // :path* carries sub-pages (/menu, /portfolio, /contact) and the query
  // string comes along automatically.
  async redirects() {
    return [
      { source: "/infinite-media", destination: "/infinitemedia", permanent: true },
      {
        source: "/infinite-media/:path*",
        destination: "/infinitemedia/:path*",
        permanent: true,
      },
    ];
  },
  // ROUTE DURABILITY (printed QR codes): there is deliberately no redirect for
  // /signal today, because the route itself exists at src/app/signal/page.tsx.
  // If it is ever removed or renamed, the permanent redirect belongs HERE, in a
  // redirects() block, because 1,000 physical cards printed Aug 2026 encode
  // https://btinvestments.co/signal?utm_source=flyer&utm_medium=qr and will
  // keep being scanned for years.
  async rewrites() {
    return [
      { source: "/proposals/:slug", destination: "/proposals/:slug.html" },
      // Proofs: design work sent to a client for review. Same shape as
      // proposals on purpose - the slug is a parameter, so adding the next
      // proof is dropping a file in public/proofs, never a code change.
      { source: "/proofs/:slug", destination: "/proofs/:slug.html" },
    ];
  },
};

export default nextConfig;
