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
      // Proofs: design work sent to a client for review. Same shape as
      // proposals on purpose - the slug is a parameter, so adding the next
      // proof is dropping a file in public/proofs, never a code change.
      { source: "/proofs/:slug", destination: "/proofs/:slug.html" },
    ];
  },
};

export default nextConfig;
