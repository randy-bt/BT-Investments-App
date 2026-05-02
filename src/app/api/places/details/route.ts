import { NextRequest, NextResponse } from "next/server";

/**
 * Place Details API — given a place_id from /api/places/autocomplete,
 * returns the structured address components (street, city, state, zip)
 * so the marketing form can split a selected suggestion into separate
 * city/state/zip fields automatically.
 *
 * Uses the same NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as the autocomplete
 * endpoint — no extra setup needed.
 */
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("place_id");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!placeId || !apiKey) {
    return NextResponse.json(
      { street: "", city: "", state: "", zip: "" },
      { status: 200 }
    );
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=address_components,formatted_address&key=${apiKey}`;

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

    const streetNumber = get("street_number");
    const route = get("route");
    const street = [streetNumber, route].filter(Boolean).join(" ");

    return NextResponse.json({
      street,
      // sublocality covers some cases where locality isn't returned (rural)
      city: get("locality") || get("sublocality") || get("postal_town"),
      state: get("administrative_area_level_1", true),
      zip: get("postal_code"),
    });
  } catch {
    return NextResponse.json(
      { street: "", city: "", state: "", zip: "" },
      { status: 200 }
    );
  }
}
