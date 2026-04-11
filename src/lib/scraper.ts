import OpenAI from 'openai'

export type ScrapedPropertyData = {
  redfin_value?: number
  zillow_value?: number
  apn?: string
  county?: string
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

// County assessor URL patterns for legal description lookup
const COUNTY_DETAIL_URLS: Record<string, { url: string; parser: (html: string) => string | null }> = {
  king: {
    url: 'https://blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=%s',
    parser: (html) => {
      const match = html.match(/LabelLegalDescription">([^<]+)/)
      return match ? match[1].replace(/\s{2,}/g, ' ').trim() : null
    },
  },
  pierce: {
    url: 'https://atip.piercecountywa.gov/#/app/propertyDetail/%s/summary',
    parser: () => null, // SPA — can't scrape directly
  },
  snohomish: {
    url: 'https://www.snoco.org/proptax/search.aspx?parcel_number=%s',
    parser: (html) => {
      const match = html.match(/Legal Description[^<]*<[^>]*>([^<]+)/i)
      return match ? match[1].trim() : null
    },
  },
  thurston: {
    url: 'https://tcproperty.co.thurston.wa.us/propsql/basic.asp?pn=%s',
    parser: (html) => {
      const match = html.match(/Legal Description[^<]*<[^>]*>([^<]+)/i)
      return match ? match[1].trim() : null
    },
  },
  kitsap: {
    url: 'https://psearch.kitsapgov.com/details.asp?RPID=%s',
    parser: (html) => {
      const match = html.match(/Legal Description[^<]*<[^>]*>([^<]+)/i)
      return match ? match[1].trim() : null
    },
  },
  skagit: {
    url: 'https://www.skagitcounty.net/Search/Property/?id=%s',
    parser: (html) => {
      const match = html.match(/Legal Description[^<]*<[^>]*>([^<]+)/i)
      return match ? match[1].trim() : null
    },
  },
}

export async function scrapePropertyData(address: string): Promise<ScrapedPropertyData> {
  // Step 1: Get Pellego data (includes APN + county for legal desc lookup)
  const pellegoData = await scrapePellego(address)

  // Step 2: Run remaining lookups in parallel
  const [redfinResult, zillowResult, legalResult] = await Promise.all([
    scrapeRedfinValue(address),
    scrapeZillowValue(address),
    pellegoData.apn && pellegoData._county
      ? scrapeLegalDescription(pellegoData.apn, pellegoData._county)
      : Promise.resolve({}),
  ])

  // Move _county to county field
  const { _county, ...pellego } = pellegoData
  if (_county) pellego.county = _county
  return { ...pellego, ...legalResult, ...zillowResult, ...redfinResult }
}

// Pellego/Lotside API for property details
async function scrapePellego(address: string): Promise<ScrapedPropertyData & { _county?: string }> {
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

    const result: ScrapedPropertyData & { _county?: string } = {}

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

    return result
  } catch {
    return {}
  }
}

// County assessor page for legal description
async function scrapeLegalDescription(apn: string, county: string): Promise<ScrapedPropertyData> {
  try {
    const countyConfig = COUNTY_DETAIL_URLS[county]
    if (!countyConfig) return {}

    const url = countyConfig.url.replace('%s', apn)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })

    if (!res.ok) return {}

    const html = await res.text()
    const legal = countyConfig.parser(html)

    return legal ? { legal_description: legal } : {}
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
