export function extractStreetNumber(address: string): string {
  const match = address.trim().match(/^(\d+)/)
  if (!match) {
    throw new Error('Address must start with a street number')
  }
  return match[1]
}

export function slugifyCity(city: string): string {
  const slug = city
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  if (!slug) {
    throw new Error('City must contain at least one alphanumeric character')
  }
  return slug
}

export function buildSlug(address: string, city: string): string {
  return `${extractStreetNumber(address)}-${slugifyCity(city)}`
}

// Given the base slug and the list of existing slugs (in the same page_type bucket),
// return the next available slug — base, or base-N for the smallest N > all used suffixes.
export function nextAvailableSlug(base: string, existing: string[]): string {
  const exact = new Set(existing)
  if (!exact.has(base)) return base

  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const suffixRe = new RegExp('^' + escaped + '-(\\d+)$')
  let max = 1
  for (const s of existing) {
    const m = s.match(suffixRe)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `${base}-${max + 1}`
}
