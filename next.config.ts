import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Client proposals are served as static HTML from public/proposals, so each
  // document stays byte-identical to the version that was signed off (handoff
  // 016). This hides the extension: /proposals/<slug> -> /proposals/<slug>.html.
  // Future proposals are a file drop into public/proposals; no config change.
  async rewrites() {
    return [
      { source: "/proposals/:slug", destination: "/proposals/:slug.html" },
    ];
  },
};

export default nextConfig;
