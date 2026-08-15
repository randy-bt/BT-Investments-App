import type { NextConfig } from "next";

// Security headers (audit 001: only HSTS was present, which Vercel sets).
//
// The CSP ships REPORT-ONLY first, deliberately. It is the one header that
// can silently break the Google map, the Meta pixel, or the Signal fonts,
// and the only way to know the allowlist is complete is to watch a real
// browser session against production. Report-Only changes nothing for
// visitors while logging every would-be violation to the console; once a
// live pass over the map + Signal + forms comes back clean, the same
// value moves to the enforcing header name. Do not add origins here
// without a reason you can write down.
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
  { key: "Content-Security-Policy-Report-Only", value: CSP },
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
