import { NextRequest, NextResponse } from "next/server";
import { placesGuard, cleanInput, cleanSession } from "@/lib/places-guard";

// Address autocomplete for BOTH the public seller form and the internal app.
// Public on purpose - see the standing rule in lib/places-guard.ts. The
// guard is what makes that safe: app users pass as before; anonymous
// callers must come from our own site, under a per-IP limit, with a real
// input, or Google is never called.
export async function GET(req: NextRequest) {
  const refused = await placesGuard(req);
  if (refused) return refused;

  const input = cleanInput(req.nextUrl.searchParams.get("input"));
  const session = cleanSession(req.nextUrl.searchParams.get("session"));
  // Server key first - see src/lib/geocode.ts for why.
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) return NextResponse.json({ predictions: [], error: "config" });
  // Under 3 characters is not worth a billed call and never was useful.
  if (!input) return NextResponse.json({ predictions: [], error: null });

  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(input)}&types=address&components=country:us` +
    (session ? `&sessiontoken=${encodeURIComponent(session)}` : "") +
    `&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  // Google returns these as HTTP 200 with a `status` field. REQUEST_DENIED
  // (billing disabled / API not enabled / bad key) and OVER_QUERY_LIMIT mean
  // the lookup is broken at the Google Cloud level - distinct from a normal
  // empty result. Surface that to the client as a config error so the UI can
  // tell the user instead of silently showing no suggestions.
  const status: string | undefined = data.status;
  if (status === "REQUEST_DENIED" || status === "OVER_QUERY_LIMIT") {
    console.error(`[places/autocomplete] Google Maps API ${status}: ${data.error_message ?? ""}`);
    return NextResponse.json({ predictions: [], error: "config" });
  }

  return NextResponse.json({
    predictions: (data.predictions || []).map(
      (p: { place_id: string; description: string }) => ({
        place_id: p.place_id,
        description: p.description,
      })
    ),
    error: null,
  });
}
