import { NextRequest, NextResponse } from 'next/server'

// TEMPORARY diagnostic (7/22): the InvestorLift resolver works from a
// residential IP but has resolved nothing in production. This probe runs
// the resolver's outbound calls from the Vercel runtime and reports what
// each host actually returns. Gated by a throwaway token; the route and
// its env var are removed once the diagnosis lands.

export const maxDuration = 60

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probe(name: string, url: string, headers: Record<string, string>) {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 12000)
    const res = await fetch(url, { headers, signal: ctl.signal, redirect: 'follow' })
    clearTimeout(t)
    const body = await res.text()
    return {
      name,
      status: res.status,
      finalUrl: res.url.slice(0, 140),
      bytes: body.length,
      snippet: body.slice(0, 160).replace(/\s+/g, ' '),
    }
  } catch (e) {
    return { name, error: (e as Error).message, cause: String((e as { cause?: unknown }).cause ?? '') }
  }
}

export async function GET(req: NextRequest) {
  const token = process.env.IL_PROBE_TOKEN
  if (!token || req.headers.get('x-probe-token') !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const results = [
    await probe(
      'nominatim',
      'https://nominatim.openstreetmap.org/reverse?lat=47.6080264&lon=-122.1256968&format=json&zoom=18',
      { 'User-Agent': 'BT-Investments-App/1.0 (contact: randy@btinvestments.co)' },
    ),
    await probe(
      'photon',
      'https://photon.komoot.io/reverse?lat=47.6080264&lon=-122.1256968',
      { 'User-Agent': 'BT-Investments-App/1.0 (contact: randy@btinvestments.co)' },
    ),
    await probe(
      'bigdatacloud',
      'https://api-bdc.net/data/reverse-geocode-client?latitude=47.6080264&longitude=-122.1256968&localityLanguage=en',
      { 'User-Agent': BROWSER_UA },
    ),
    await probe('investorlift-page', 'https://investorlift.com/marketplace/p/326312', {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html',
    }),
  ]
  return NextResponse.json({ results })
}
