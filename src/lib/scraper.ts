import OpenAI from 'openai'

export type ScrapedPropertyData = {
  redfin_value?: number
  zillow_value?: number
  county_value?: number
  apn?: string
  county?: string
  zoning?: string
  legal_description?: string
  year_built?: number
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  lot_size?: string
  property_type?: string
  owner_name?: string
  owner_mailing_address?: string
}

// Generic parser for county assessor pages — looks for legal description and assessed/appraised value
function parseCountyPage(html: string): { legal_description?: string; county_value?: number } {
  const result: { legal_description?: string; county_value?: number } = {}

  // King County specific parser
  const kingLegal = html.match(/LabelLegalDescription">([^<]+)/)
  if (kingLegal) {
    result.legal_description = kingLegal[1].replace(/\s{2,}/g, ' ').trim()
  }
  const kingVal = html.match(/Appraised Total Value[\s\S]*?GridViewRowStyle">\s*(?:<td>[^<]*<\/td>){7}<td>([\d,]+)<\/td>/)
  if (kingVal) {
    result.county_value = parseInt(kingVal[1].replace(/,/g, ''))
  }

  // Generic patterns (Snohomish, Thurston, Kitsap, Skagit, etc.)
  if (!result.legal_description) {
    const legalMatch = html.match(/Legal Description[^<]*<[^>]*>([^<]+)/i)
    if (legalMatch) result.legal_description = legalMatch[1].trim()
  }
  if (!result.county_value) {
    const valMatch = html.match(/(?:Appraised|Assessed|Market)\s*(?:Total)?\s*(?:Value)?[^$]*\$([\d,]+)/i)
    if (valMatch) result.county_value = parseInt(valMatch[1].replace(/,/g, ''))
  }

  return result
}

export async function scrapePropertyData(address: string): Promise<ScrapedPropertyData> {
  // Step 1: Get Lotside/Pellego data (includes APN, county, and the property page slug)
  const pellegoData = await scrapePellego(address)

  // Step 2: Get the county assessor URL from Lotside's property page
  // Lotside's property page has the APN as a hyperlink that goes directly to the county page
  const countyUrlFromLotside = pellegoData._lotsideSlug && pellegoData.apn
    ? await getCountyUrlFromLotside(pellegoData._lotsideSlug, pellegoData.apn)
    : null

  // Step 3: Run remaining lookups in parallel
  const [redfinResult, zillowResult, countyResult] = await Promise.all([
    scrapeRedfinValue(address),
    scrapeZillowValue(address),
    countyUrlFromLotside
      ? scrapeCountyPageDirect(countyUrlFromLotside)
      : Promise.resolve({}),
  ])

  // Move internal fields to final output
  const { _county, _lotsideSlug: _, ...pellego } = pellegoData
  if (_county) pellego.county = normalizeCountyName(_county)
  return { ...pellego, ...countyResult, ...zillowResult, ...redfinResult }
}

// Normalize county name: "King County" → "king", "SNOHOMISH" → "snohomish"
function normalizeCountyName(county: string): string {
  return county.toLowerCase().replace(/\s*county\s*/gi, '').trim()
}

// Pellego/Lotside API for property details
async function scrapePellego(address: string): Promise<ScrapedPropertyData & { _county?: string; _lotsideSlug?: string }> {
  try {
    // Step 1: Typeahead to get the normalized address with zip code
    const typeaheadRes = await fetch(
      `https://newton.pellego.com/api/v1/proformas/typeahead?term=${encodeURIComponent(address)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )

    if (!typeaheadRes.ok) return {}

    const results = await typeaheadRes.json()
    const parcel = results?.find?.((r: { type: string }) => r.type === 'parcel')
    if (!parcel?.address_for_url) return {}

    // Step 2: Get full property data
    const slug = parcel.address_for_url.replace(/ /g, '-')
    const proformaRes = await fetch(
      `https://newton.pellego.com/api/v1/proformas/address/${slug}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )

    if (!proformaRes.ok) return {}

    const data = await proformaRes.json()
    const p = data.parcel || {}
    const s = data.structure || {}

    const result: ScrapedPropertyData & { _county?: string; _lotsideSlug?: string } = {}

    // Store the slug so we can fetch Lotside's property page later
    result._lotsideSlug = slug

    // APN (remove dashes for storage consistency)
    if (p.parcel_number) {
      result.apn = p.parcel_number.replace(/-/g, '')
      result._county = (p.county || parcel.county_name || '').toLowerCase()
    }

    if (p.owner1_name) result.owner_name = p.owner1_name
    if (p.owner_address) result.owner_mailing_address = p.owner_address
    if (p.lot_square_feet) result.lot_size = `${Math.round(p.lot_square_feet).toLocaleString()} sqft`

    if (s.bedrooms) result.bedrooms = s.bedrooms
    if (s.bathrooms) result.bathrooms = s.bathrooms
    if (s.square_feet_finished) result.sqft = s.square_feet_finished
    if (s.year_built) result.year_built = s.year_built
    if (s.property_type) result.property_type = s.property_type
    if (p.zoning) result.zoning = p.zoning
    else if (p.zoning_code) result.zoning = p.zoning_code

    return result
  } catch {
    return {}
  }
}

// Fetch Lotside's property page and extract the county assessor URL from the APN hyperlink
async function getCountyUrlFromLotside(slug: string, apn: string): Promise<string | null> {
  // Try both lotside.com and pellego.com property page URLs
  const urls = [
    `https://www.lotside.com/proforma/${slug}`,
    `https://pellego.com/proforma/${slug}`,
  ]

  for (const pageUrl of urls) {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        redirect: 'follow',
      })

      if (!res.ok) continue

      const html = await res.text()

      // Look for anchor tags containing the APN (with or without dashes)
      const apnClean = apn.replace(/-/g, '')
      const apnWithDashes = apn

      // Try multiple patterns to find the county link:
      // 1. Link text contains the APN
      const patterns = [
        new RegExp(`<a[^>]+href="(https?://[^"]+)"[^>]*>[^<]*${apnClean}[^<]*</a>`, 'i'),
        new RegExp(`<a[^>]+href="(https?://[^"]+)"[^>]*>[^<]*${apnWithDashes}[^<]*</a>`, 'i'),
        // 2. Link href contains the APN (some pages use it in the URL)
        new RegExp(`<a[^>]+href="(https?://[^"]*${apnClean}[^"]*)"`, 'i'),
        // 3. Look for known county assessor domains near the APN text
        new RegExp(`<a[^>]+href="(https?://(?:blue\\.kingcounty|atip\\.piercecounty|www\\.snoco\\.org|tcproperty\\.co\\.thurston)[^"]+)"`, 'i'),
      ]

      for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) return match[1]
      }
    } catch {
      continue
    }
  }

  return null
}

// Scrape county page using a URL obtained from Lotside
// Tries direct fetch first, falls back to AI web search for SPAs (e.g. Pierce County)
async function scrapeCountyPageDirect(url: string): Promise<ScrapedPropertyData> {
  // Try direct fetch first
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })

    if (res.ok) {
      const html = await res.text()
      const parsed = parseCountyPage(html)
      if (parsed.legal_description || parsed.county_value) {
        const result: ScrapedPropertyData = {}
        if (parsed.legal_description) result.legal_description = parsed.legal_description
        if (parsed.county_value) result.county_value = parsed.county_value
        return result
      }
    }
  } catch {
    // Direct fetch failed — fall through to AI fallback
  }

  // AI fallback for SPAs and pages where direct scraping returned nothing
  return scrapeCountyWithAI(url)
}

const COUNTY_PROMPT = `You are a real estate data lookup assistant. Go to this county assessor property page and extract two pieces of information:

1. The legal description of the property
2. The total assessed or appraised value (the county's valuation of the property)

Respond in EXACTLY this JSON format with no other text:
{"legal_description": "LOT 5 BLK 3 SOME PLAT", "county_value": 450000}

Rules:
- county_value must be an integer with no dollar sign or commas
- legal_description should be the full legal description text
- If you cannot find a value, use null for that field
- Do not guess — only report what you find on the page`

async function scrapeCountyWithAI(url: string): Promise<ScrapedPropertyData> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await openai.responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: `${COUNTY_PROMPT}\n\nCounty assessor page URL: ${url}`,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textItem = (response as any).output?.find(
      (item: { type: string }) => item.type === 'message'
    )

    if (!textItem?.content) return {}

    const text = textItem.content
      .filter((c: { type: string }) => c.type === 'output_text')
      .map((c: { text: string }) => c.text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return {}

    const parsed = JSON.parse(jsonMatch[0])
    const result: ScrapedPropertyData = {}

    if (typeof parsed.legal_description === 'string' && parsed.legal_description) {
      result.legal_description = parsed.legal_description
    }
    if (typeof parsed.county_value === 'number') {
      result.county_value = parsed.county_value
    }

    return result
  } catch {
    return {}
  }
}

// Direct scraping for exact Redfin Estimate via DuckDuckGo → Redfin page
async function scrapeRedfinValue(address: string): Promise<ScrapedPropertyData> {
  try {
    const ddgRes = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`redfin ${address}`)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )

    if (!ddgRes.ok) return {}

    const ddgHtml = await ddgRes.text()
    const urlMatch = ddgHtml.match(/redfin\.com\/[^"&]*home\/[0-9]+/)
    if (!urlMatch) return {}

    const pageRes = await fetch(`https://www.${urlMatch[0]}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })

    if (!pageRes.ok) return {}

    const html = await pageRes.text()

    const estimateMatch = html.match(/RedfinEstimateValueHeader[\s\S]*?class="price[^"]*"[^>]*>\s*\$([\d,]+)/)
    if (estimateMatch) {
      return { redfin_value: parseInt(estimateMatch[1].replace(/,/g, '')) }
    }

    const altMatch = html.match(/\$([\d,]+)\s*(?:Redfin Estimate|Estimate)/i)
    if (altMatch) {
      return { redfin_value: parseInt(altMatch[1].replace(/,/g, '')) }
    }

    return {}
  } catch {
    return {}
  }
}

// AI web search for Zillow Zestimate only
const ZILLOW_PROMPT = `You are a real estate data lookup assistant. Search zillow.com for this property and find the Zestimate (Zillow's automated home value estimate).

Respond in EXACTLY this JSON format with no other text:
{"zillow_value": 560000}

Rules:
- The value must be an integer with no dollar sign or commas
- If you cannot find the Zestimate on zillow.com, return {"zillow_value": null}
- Do not guess — only report the exact Zestimate you find on the Zillow property page`

async function scrapeZillowValue(address: string): Promise<ScrapedPropertyData> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await openai.responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: `${ZILLOW_PROMPT}\n\nProperty address: ${address}`,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textItem = (response as any).output?.find(
      (item: { type: string }) => item.type === 'message'
    )

    if (!textItem?.content) return {}

    const text = textItem.content
      .filter((c: { type: string }) => c.type === 'output_text')
      .map((c: { text: string }) => c.text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return {}

    const parsed = JSON.parse(jsonMatch[0])
    if (typeof parsed.zillow_value === 'number') {
      return { zillow_value: parsed.zillow_value }
    }

    return {}
  } catch {
    return {}
  }
}
