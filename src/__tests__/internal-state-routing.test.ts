import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// THE /api/ ALLOWLIST TRAP (Sept 2026).
//
// proxy.ts routes anything starting with /api/ into the authenticated app and
// 307s it to /login unless it is explicitly allowlisted. This has silently
// broken live functionality three times now: two cron endpoints, and the
// internal unlock form. Each time the symptom was not an error anyone saw.
//
// /api/internal/state/ is the fourth candidate and the worst one to lose,
// because the page catches fetch failures and falls back to localStorage. A
// missing allowlist entry would look EXACTLY like everything working, on
// whichever device you happen to be holding, while Randy and Mikaela's boards
// quietly diverged. There is no error state to notice.
//
// The allowlist and the cookie check are a matched pair: the exemption is
// from app auth only, and the handler's own gate is what protects the data.
// A test that only checked the allowlist would happily pass on a wide-open
// endpoint, so this checks both halves.

const root = join(__dirname, "..", "..");
const proxy = readFileSync(join(root, "src", "proxy.ts"), "utf8");
const route = readFileSync(
  join(root, "src", "app", "api", "internal", "state", "[slug]", "route.ts"),
  "utf8",
);

describe("/api/internal/state reaches its handler and is still gated", () => {
  it("is exempt from app auth, or every sync 307s to /login", () => {
    expect(proxy).toMatch(/pathname\.startsWith\('\/api\/internal\/state\/'\)/);
  });

  it("sits inside the always-public allowlist, not after the app-auth branch", () => {
    // Order matters: the allowlist returns early. If this line drifted below
    // the isAppRequest check it would be dead code and the endpoint would
    // 307 again, with the string still present to fool a naive grep.
    const allowlist = proxy.indexOf("pathname.startsWith('/api/internal/state/')");
    const appAuth = proxy.indexOf("const isAppRequest");
    expect(allowlist).toBeGreaterThan(-1);
    expect(appAuth).toBeGreaterThan(-1);
    expect(allowlist).toBeLessThan(appAuth);
  });

  it("still verifies the bt_internal cookie in the handler itself", () => {
    // The allowlist above removes app auth. If this check ever goes, the
    // endpoint is world-readable AND world-writable with no other guard.
    expect(route).toMatch(/verifyInternalToken/);
    expect(route).toMatch(/INTERNAL_COOKIE/);
    expect(route).toMatch(/status: 401/);
  });

  it("keeps the /internal/* page gate intact", () => {
    expect(proxy).toMatch(/pathname === '\/internal' \|\| pathname\.startsWith\('\/internal\/'\)/);
  });

  it("ships the table the endpoint reads, as a migration in the repo", () => {
    // The route 500s without it, which degrades to local-only, which is the
    // exact silent divergence this feature exists to end.
    const migration = join(root, "supabase", "migrations", "094_internal_page_state.sql");
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS internal_page_state/);
    expect(sql).toMatch(/slug TEXT PRIMARY KEY/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    // MCP-applied migrations get no default grants; without this the route
    // 401s from PostgREST at runtime (migration 073 learned this the hard way).
    expect(sql).toMatch(/GRANT ALL ON internal_page_state TO service_role/);
  });

  it("serves the Tacoma page with its noindex intact", () => {
    const page = readFileSync(join(root, "public", "internal", "tacoma-house.html"), "utf8");
    expect(page).toMatch(/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i);
    // The page calls the endpoint this file protects; if the slug here and
    // the slug in the page ever drift, sync silently stops.
    expect(page).toContain("/api/internal/state/tacoma-house");
  });
});
