/**
 * Fetch monthly median home prices from Redfin's public data center.
 * Source: city_market_tracker.tsv000.gz (~1GB compressed, all US cities).
 *
 * We STREAM the gzipped TSV line-by-line so memory stays low — only keeping
 * rows for Seattle, Tacoma, and Bellevue (WA) with the latest period.
 */

import { createGunzip } from 'zlib'
import { Readable } from 'stream'
import { createInterface } from 'readline'

const REDFIN_URL =
  'https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/city_market_tracker.tsv000.gz'

const CITY_MAP: Record<string, string> = {
  median_seattle: 'Seattle',
  median_tacoma: 'Tacoma',
  median_bellevue: 'Bellevue',
}

const TARGET_CITIES = new Set(Object.values(CITY_MAP))

type RedfinResult = Record<string, { value: number; period: string } | null>

export async function fetchRedfinMedianPrices(): Promise<RedfinResult> {
  const result: RedfinResult = {
    median_seattle: null,
    median_tacoma: null,
    median_bellevue: null,
  }

  try {
    const res = await fetch(REDFIN_URL, {
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok || !res.body) return result

    // Column indices (resolved from header)
    let colCity = -1
    let colState = -1
    let colPeriodBegin = -1
    let colMedian = -1
    let colPropertyType = -1
    let headerParsed = false

    // Track latest period per stat key
    const latest: Record<string, { value: number; periodBegin: string }> = {}

    // Stream: fetch body → gunzip → readline
    const webStream = res.body
    const nodeStream = Readable.fromWeb(webStream as import('stream/web').ReadableStream)
    const gunzip = createGunzip()
    const rl = createInterface({ input: nodeStream.pipe(gunzip) })

    for await (const line of rl) {
      if (!headerParsed) {
        const header = line.split('\t')
        colCity = header.indexOf('city')
        colState = header.indexOf('state_code')
        colPeriodBegin = header.indexOf('period_begin')
        colMedian = header.indexOf('median_sale_price')
        colPropertyType = header.indexOf('property_type')
        headerParsed = true

        if (colCity === -1 || colMedian === -1 || colPeriodBegin === -1) {
          console.error('[redfin] Missing expected columns in TSV')
          break
        }
        continue
      }

      const cols = line.split('\t')

      // Quick filters before doing any string comparisons
      if (colState !== -1 && cols[colState] !== 'WA') continue
      if (!TARGET_CITIES.has(cols[colCity])) continue
      if (colPropertyType !== -1 && cols[colPropertyType] !== 'All Residential') continue

      const city = cols[colCity]
      const median = parseFloat(cols[colMedian])
      const periodBegin = cols[colPeriodBegin]

      if (isNaN(median) || !periodBegin) continue

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
