type ScrapedPropertyData = {
  apn?: string
  year_built?: number
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  lot_size?: string
  property_type?: string
  owner_name?: string
  owner_mailing_address?: string
  redfin_value?: number
}

export async function scrapePropertyData(address: string): Promise<ScrapedPropertyData> {
  try {
    // Step 1: Search Redfin for the address using their autocomplete endpoint
    const searchUrl = `https://www.redfin.com/stingray/do/location-autocomplete?location=${encodeURIComponent(address)}&v=2`

    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!searchRes.ok) return {}

    const searchText = await searchRes.text()
    // Redfin prepends "{}&&" to JSON responses
    const cleanJson = searchText.replace(/^{}&&/, '')
    const searchData = JSON.parse(cleanJson)

    // Find the first exact match result
    const payload = searchData?.payload
    if (!payload?.sections) return {}

    let propertyUrl: string | null = null
    for (const section of payload.sections) {
      for (const row of section.rows || []) {
        if (row.url) {
          propertyUrl = row.url
          break
        }
      }
      if (propertyUrl) break
    }

    if (!propertyUrl) return {}

    // Step 2: Fetch property details via Redfin's API
    const detailUrl = `https://www.redfin.com/stingray/api/home/details/avm?path=${encodeURIComponent(propertyUrl)}`

    const detailRes = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!detailRes.ok) {
      // Fallback: try to scrape the HTML page directly
      return await scrapeFromHtml(propertyUrl)
    }

    const detailText = await detailRes.text()
    const cleanDetailJson = detailText.replace(/^{}&&/, '')
    const detailData = JSON.parse(cleanDetailJson)

    const result: ScrapedPropertyData = {}
    const propertyInfo = detailData?.payload

    if (propertyInfo) {
      if (propertyInfo.predictedValue) result.redfin_value = propertyInfo.predictedValue
    }

    // Also try the main property page for more details
    const pageData = await scrapeFromHtml(propertyUrl)
    return { ...pageData, ...result }
  } catch {
    return {}
  }
}

async function scrapeFromHtml(propertyPath: string): Promise<ScrapedPropertyData> {
  try {
    const url = `https://www.redfin.com${propertyPath}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!res.ok) return {}

    const html = await res.text()
    const result: ScrapedPropertyData = {}

    // Parse key facts from HTML
    const bedsMatch = html.match(/(\d+)\s*(?:bed|Bed|BR)/i)
    if (bedsMatch) result.bedrooms = parseInt(bedsMatch[1])

    const bathsMatch = html.match(/([\d.]+)\s*(?:bath|Bath|BA)/i)
    if (bathsMatch) result.bathrooms = parseFloat(bathsMatch[1])

    const sqftMatch = html.match(/([\d,]+)\s*(?:sq\s*ft|Sq\.\s*Ft)/i)
    if (sqftMatch) result.sqft = parseInt(sqftMatch[1].replace(/,/g, ''))

    const yearMatch = html.match(/(?:Built|Year Built)[:\s]*(\d{4})/i)
    if (yearMatch) result.year_built = parseInt(yearMatch[1])

    const lotMatch = html.match(/(?:Lot Size)[:\s]*([\d,.]+\s*(?:acres?|sq\s*ft))/i)
    if (lotMatch) result.lot_size = lotMatch[1]

    const typeMatch = html.match(/(?:Property Type|Style)[:\s]*(Single Family|Multi[- ]?Family|Condo|Townhouse|Land|Mobile)/i)
    if (typeMatch) result.property_type = typeMatch[1]

    const priceMatch = html.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*(?:Redfin Estimate|Estimate)/i)
    if (priceMatch) result.redfin_value = parseFloat(priceMatch[1].replace(/,/g, ''))

    return result
  } catch {
    return {}
  }
}
