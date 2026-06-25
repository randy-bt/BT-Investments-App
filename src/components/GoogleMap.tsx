"use client";

type GoogleMapProps = {
  address: string;
};

/**
 * Renders a Google map for a property address using the Maps Embed API.
 *
 * We intentionally use the Embed API iframe rather than client-side geocoding
 * + the Maps JavaScript API: the Embed API is free, has no usage cap, resolves
 * the address itself (so partial addresses like "7024 SE 20th St Mercer Island"
 * still work), and — unlike the Geocoding/Places web services — does not require
 * billing to be enabled on the Google Cloud project. The previous version
 * geocoded each address in the browser, which silently failed with
 * REQUEST_DENIED whenever billing lapsed and surfaced as "Could not find
 * location" on every record.
 */
export function GoogleMap({ address }: GoogleMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full min-h-[250px] bg-neutral-50 text-sm text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
        Map API key not configured
      </div>
    );
  }

  if (!address?.trim()) {
    return (
      <div className="flex items-center justify-center h-full min-h-[250px] bg-neutral-50 text-sm text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
        No address on file
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(
    address
  )}&maptype=satellite`;

  return (
    <iframe
      title={`Map of ${address}`}
      src={src}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
      className="w-full h-full min-h-[250px] border-0"
    />
  );
}
