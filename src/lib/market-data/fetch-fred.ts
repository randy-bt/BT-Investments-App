/**
 * Fetch daily market stats from FRED (Federal Reserve Economic Data).
 * Series: MORTGAGE30US (30-yr mortgage), DGS10 (10-yr treasury), SP500.
 */

type FredResult = {
  mortgage_30yr: { value: number; period: string } | null
  treasury_10yr: { value: number; period: string } | null
  sp500: { value: number; period: string } | null
}

async function fetchSeries(
  apiKey: string,
  seriesId: string
): Promise<{ value: number; date: string } | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null

    const data = await res.json()
    const observations = data.observations as { date: string; value: string }[]

    // Find most recent non-"." value (FRED uses "." for missing)
    for (const obs of observations) {
      if (obs.value !== '.') {
        return { value: parseFloat(obs.value), date: obs.date }
      }
    }
    return null
  } catch {
    return null
  }
}

function formatFredDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export async function fetchFredStats(): Promise<FredResult> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) {
    return { mortgage_30yr: null, treasury_10yr: null, sp500: null }
  }

  const [mortgage, treasury, sp500] = await Promise.all([
    fetchSeries(apiKey, 'MORTGAGE30US'),
    fetchSeries(apiKey, 'DGS10'),
    fetchSeries(apiKey, 'SP500'),
  ])

  return {
    mortgage_30yr: mortgage
      ? { value: mortgage.value, period: formatFredDate(mortgage.date) }
      : null,
    treasury_10yr: treasury
      ? { value: treasury.value, period: formatFredDate(treasury.date) }
      : null,
    sp500: sp500
      ? { value: sp500.value, period: formatFredDate(sp500.date) }
      : null,
  }
}
