import { NextRequest, NextResponse } from "next/server";
import { placesGuard, cleanPlaceId, cleanSession } from "@/lib/places-guard";

/**
 * Place Details - given a place_id from /api/places/autocomplete, returns
 * the structured address (street, city, state, zip) so a form can split a
 * selected suggestion into its fields.
 *
 * Public on purpose, same guard as autocomplete (lib/places-guard.ts). The
 * optional `session` is the token the client used for autocomplete; passing
 * it here closes the Google session so the whole lookup bills as one.
 */
const EMPTY = { street: "", city: "", state: "", zip: "" };

export async function GET(req: NextRequest) {
  const refused = await placesGuard(req);
  if (refused) return refused;

  const placeId = cleanPlaceId(req.nextUrl.searchParams.get("place_id"));
  const session = cleanSession(req.nextUrl.searchParams.get("session"));
  // Server key first - see src/lib/geocode.ts for why.
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!placeId || !apiKey) return NextResponse.json(EMPTY, { status: 200 });

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}&fields=address_components,formatted_address` +
    (session ? `&sessiontoken=${encodeURIComponent(session)}` : "") +
    `&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const components: Array<{ types: string[]; long_name: string; short_name: string }> =
      data.result?.address_components ?? [];

    const get = (type: string, useShort = false) => {
      const c = components.find((x) => x.types.includes(type));
      if (!c) return "";
      return useShort ? c.short_name : c.long_name;
    };

    const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
    return NextResponse.json({
      street,
      // sublocality covers some cases where locality isn't returned (rural)
      city: get("locality") || get("sublocality") || get("postal_town"),
      state: get("administrative_area_level_1", true),
      zip: get("postal_code"),
    });
  } catch {
    return NextResponse.json(EMPTY, { status: 200 });
  }
}
