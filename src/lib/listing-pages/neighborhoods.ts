export type NeighborhoodRegion =
  | 'Seattle'
  | 'Eastside'
  | 'South King'
  | 'North Sound'
  | 'South Sound'
  | 'Kitsap'
  | 'Other WA'

export type NeighborhoodPreset = {
  slug: string
  label: string
  region: NeighborhoodRegion
}

export const NEIGHBORHOOD_PRESETS: readonly NeighborhoodPreset[] = [
  // Seattle proper
  { slug: 'ballard',             label: 'Ballard',             region: 'Seattle' },
  { slug: 'capitol-hill',        label: 'Capitol Hill',        region: 'Seattle' },
  { slug: 'queen-anne',          label: 'Queen Anne',          region: 'Seattle' },
  { slug: 'fremont',             label: 'Fremont',             region: 'Seattle' },
  { slug: 'wallingford',         label: 'Wallingford',         region: 'Seattle' },
  { slug: 'greenwood',           label: 'Greenwood',           region: 'Seattle' },
  { slug: 'phinney-ridge',       label: 'Phinney Ridge',       region: 'Seattle' },
  { slug: 'magnolia',            label: 'Magnolia',            region: 'Seattle' },
  { slug: 'west-seattle',        label: 'West Seattle',        region: 'Seattle' },
  { slug: 'beacon-hill',         label: 'Beacon Hill',         region: 'Seattle' },
  { slug: 'columbia-city',       label: 'Columbia City',       region: 'Seattle' },
  { slug: 'rainier-beach',       label: 'Rainier Beach',       region: 'Seattle' },
  { slug: 'georgetown',          label: 'Georgetown',          region: 'Seattle' },
  { slug: 'sodo',                label: 'SoDo',                region: 'Seattle' },
  { slug: 'pioneer-square',      label: 'Pioneer Square',      region: 'Seattle' },
  { slug: 'belltown',            label: 'Belltown',            region: 'Seattle' },
  { slug: 'south-lake-union',    label: 'South Lake Union',    region: 'Seattle' },
  { slug: 'eastlake',            label: 'Eastlake',            region: 'Seattle' },
  { slug: 'roosevelt',           label: 'Roosevelt',           region: 'Seattle' },
  { slug: 'ravenna',             label: 'Ravenna',             region: 'Seattle' },
  { slug: 'university-district', label: 'University District', region: 'Seattle' },
  { slug: 'northgate',           label: 'Northgate',           region: 'Seattle' },
  { slug: 'lake-city',           label: 'Lake City',           region: 'Seattle' },
  { slug: 'maple-leaf',          label: 'Maple Leaf',          region: 'Seattle' },
  { slug: 'green-lake',          label: 'Green Lake',          region: 'Seattle' },
  { slug: 'madison-park',        label: 'Madison Park',        region: 'Seattle' },
  { slug: 'madrona',             label: 'Madrona',             region: 'Seattle' },
  { slug: 'mount-baker',         label: 'Mount Baker',         region: 'Seattle' },

  // Eastside
  { slug: 'bellevue',            label: 'Bellevue',            region: 'Eastside' },
  { slug: 'kirkland',            label: 'Kirkland',            region: 'Eastside' },
  { slug: 'redmond',             label: 'Redmond',             region: 'Eastside' },
  { slug: 'sammamish',           label: 'Sammamish',           region: 'Eastside' },
  { slug: 'issaquah',            label: 'Issaquah',            region: 'Eastside' },
  { slug: 'bothell',             label: 'Bothell',             region: 'Eastside' },
  { slug: 'kenmore',             label: 'Kenmore',             region: 'Eastside' },
  { slug: 'mercer-island',       label: 'Mercer Island',       region: 'Eastside' },

  // South King
  { slug: 'renton',              label: 'Renton',              region: 'South King' },
  { slug: 'kent',                label: 'Kent',                region: 'South King' },
  { slug: 'auburn',              label: 'Auburn',              region: 'South King' },
  { slug: 'federal-way',         label: 'Federal Way',         region: 'South King' },
  { slug: 'burien',              label: 'Burien',              region: 'South King' },
  { slug: 'tukwila',             label: 'Tukwila',             region: 'South King' },
  { slug: 'seatac',              label: 'SeaTac',              region: 'South King' },
  { slug: 'des-moines',          label: 'Des Moines',          region: 'South King' },

  // North Sound
  { slug: 'lynnwood',            label: 'Lynnwood',            region: 'North Sound' },
  { slug: 'edmonds',             label: 'Edmonds',             region: 'North Sound' },
  { slug: 'mountlake-terrace',   label: 'Mountlake Terrace',   region: 'North Sound' },
  { slug: 'shoreline',           label: 'Shoreline',           region: 'North Sound' },
  { slug: 'monroe',              label: 'Monroe',              region: 'North Sound' },
  { slug: 'mill-creek',          label: 'Mill Creek',          region: 'North Sound' },
  { slug: 'mukilteo',            label: 'Mukilteo',            region: 'North Sound' },
  { slug: 'everett',             label: 'Everett',             region: 'North Sound' },
  { slug: 'marysville',          label: 'Marysville',          region: 'North Sound' },
  { slug: 'bellingham',          label: 'Bellingham',          region: 'North Sound' },

  // South Sound
  { slug: 'tacoma',              label: 'Tacoma',              region: 'South Sound' },
  { slug: 'lakewood',            label: 'Lakewood',            region: 'South Sound' },
  { slug: 'university-place',    label: 'University Place',    region: 'South Sound' },
  { slug: 'puyallup',            label: 'Puyallup',            region: 'South Sound' },
  { slug: 'olympia',             label: 'Olympia',             region: 'South Sound' },
  { slug: 'gig-harbor',          label: 'Gig Harbor',          region: 'South Sound' },

  // Kitsap
  { slug: 'bremerton',           label: 'Bremerton',           region: 'Kitsap' },
  { slug: 'port-orchard',        label: 'Port Orchard',        region: 'Kitsap' },
  { slug: 'silverdale',          label: 'Silverdale',          region: 'Kitsap' },
  { slug: 'poulsbo',             label: 'Poulsbo',             region: 'Kitsap' },

  // Other WA
  { slug: 'vancouver',           label: 'Vancouver',           region: 'Other WA' },
  { slug: 'yakima',              label: 'Yakima',              region: 'Other WA' },
  { slug: 'spokane',             label: 'Spokane',             region: 'Other WA' },
] as const

export function findNeighborhoodPreset(slug: string): NeighborhoodPreset | undefined {
  return NEIGHBORHOOD_PRESETS.find((n) => n.slug === slug)
}

export function neighborhoodPresetPhotoPath(slug: string): string {
  return `/marketing/neighborhoods/${slug}.jpg`
}
