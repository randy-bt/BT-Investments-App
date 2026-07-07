import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  // In-handler auth (defense-in-depth alongside the middleware) — this
  // proxies a billed Google API, so it must never be callable anonymously.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ predictions: [], error: "unauthorized" }, { status: 401 });
  }

  const input = req.nextUrl.searchParams.get("input");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ predictions: [], error: "config" });
  }
  if (!input) {
    return NextResponse.json({ predictions: [], error: null });
  }

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  // Google returns these as HTTP 200 with a `status` field. REQUEST_DENIED
  // (billing disabled / API not enabled / bad key) and OVER_QUERY_LIMIT mean
  // the lookup is broken at the Google Cloud level — distinct from a normal
  // empty result. Surface that to the client as a config error so the UI can
  // tell the user instead of silently showing no suggestions.
  const status: string | undefined = data.status;
  if (status === "REQUEST_DENIED" || status === "OVER_QUERY_LIMIT") {
    console.error(
      `[places/autocomplete] Google Maps API ${status}: ${data.error_message ?? ""}`
    );
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
