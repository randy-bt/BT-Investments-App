/**
 * The Google Cloud Map ID every interactive map on the site renders with.
 *
 * Not optional: AdvancedMarker requires a Map ID, and a map that mounts one
 * without a valid ID does not merely lose its pin - Google refuses to draw the
 * map at all and shows "This page can't load Google Maps correctly." That is
 * what happened to the public listing pages on 8/13, while the lead record map
 * was fine, because only the latter passed an ID.
 *
 * The name is historical - it was minted for the lead record map before there
 * was a second one. Kept as-is deliberately: a Map ID has to be registered by
 * hand in the Google Cloud console, and this one is already registered and
 * proven, so reusing it means a new map surface needs no console work at all.
 */
export const BT_MAP_ID = 'lead-record-map'
