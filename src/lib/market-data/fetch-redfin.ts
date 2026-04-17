/**
 * Fetch monthly median home prices from Redfin's public data center.
 * Source: city_market_tracker.tsv000.gz (all US cities, updated monthly).
 * We filter for Seattle, Tacoma, and Bellevue and grab the latest median_sale_price.
 */

import { gunzipSync } from 'zlib'

const REDFIN_URL =
  'https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/city_market_tracker.tsv000.gz'

// Map stat_key → city name as it appears in Redfin data
const CITY_MAP: Record<string, string> = {
  median_seattle: 'Seattle',
  median_tacoma: 'Tacoma',
  median_bellevue: 'Bellevue',
}

type RedfinResult = Record<string, { value: number; period: string } | null>

export async function fetchRedfinMedianPrices(): Promise<RedfinResult> {
  const result: RedfinResult = {
    median_seattle: null,
    median_tacoma: null,
    median_bellevue: null,
  }

  try {
    const res = await fetch(REDFIN_URL, {
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) return result

    const buffer = Buffer.from(await res.arrayBuffer())
    const decompressed = gunzipSync(buffer)
    const text = decompressed.toString('utf-8')

    const lines = text.split('\n')
    if (lines.length < 2) return result

    // Parse header to find column indices
    const header = lines[0].split('\t')
    const colCity = header.indexOf('city')
    const colState = header.indexOf('state_code')
    const colPeriodBegin = header.indexOf('period_begin')
    const colMedian = header.indexOf('median_sale_price')
    const colPropertyType = header.indexOf('property_type')

    if (colCity === -1 || colMedian === -1 || colPeriodBegin === -1) {
      console.error('[redfin] Missing expected columns in TSV')
      return result
    }

    // Collect all matching rows, keep the latest period per city
    const latest: Record<string, { value: number; periodBegin: string }> = {}

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t')
      if (!cols[colCity]) continue

      // Only WA state
      if (colState !== -1 && cols[colState] !== 'WA') continue

      // Only "All Residential" property type (not condos-only, etc.)
      if (colPropertyType !== -1 && cols[colPropertyType] !== 'All Residential') continue

      const city = cols[colCity]
      const median = parseFloat(cols[colMedian])
      const periodBegin = cols[colPeriodBegin]

      if (!city || isNaN(median) || !periodBegin) continue

      // Check if this city is one we care about
      for (const [key, targetCity] of Object.entries(CITY_MAP)) {
        if (city === targetCity) {
          const existing = latest[key]
          if (!existing || periodBegin > existing.periodBegin) {
            latest[key] = { value: median, periodBegin }
          }
        }
      }
    }

    // Format results
    for (const [key, data] of Object.entries(latest)) {
      if (data) {
        const d = new Date(data.periodBegin + 'T00:00:00')
        const period = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        result[key] = { value: data.value, period }
      }
    }
  } catch (e) {
    console.error('[redfin] Failed to fetch median prices:', e)
  }

  return result
}
