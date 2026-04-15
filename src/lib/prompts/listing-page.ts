export type ListingPageInputs = {
  address: string
  price: string
  beds: number
  baths: number
  sqft: number
  lotSize: string
  yearBuilt: number
  zoning: string
  occupancy: string
  nearbySalesRange: string
  countyPageLink: string
  googleDriveLink: string
  frontPhotoUrl: string
  satellitePhotoUrl: string
  mapPhotoUrl: string
}

const HTML_TEMPLATE = `<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ADDRESS}} — One-Page Investor Flyer</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --fg:#111827; --muted:#6b7280; --accent:#0ea5e9; --line:#e5e7eb;
    --soft-yellow:#fffbeb; --soft-yellow-border:#fde68a;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;color:var(--fg)}
  .wrap{max-width:900px;margin:20px auto 28px;padding:0 18px}
  header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
  h1{margin:0;font-size:26px;line-height:1.15}
  .sub{margin:6px 0 0;color:var(--muted);font-size:14px}
  .price{font-size:22px;font-weight:700;color:#6e8439;text-align:right}
  .mini{color:var(--muted);font-size:13px;text-align:right}
  .card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}
  .card h2{margin:4px 0 8px;font-size:15px}
  .pills{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}
  .pill{border:1px solid var(--line);background:#f8fafc;border-radius:999px;padding:6px 10px;font-size:13px}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  ul{margin:0;padding-left:18px}
  li{margin:6px 0}
  .cta{display:inline-block;margin:10px 0 0;padding:8px 12px;border:1px solid #6e8439;border-radius:10px;background:#6e8439;color:#ffffff;text-decoration:none;font-size:13px}
  footer{margin-top:10px;color:var(--muted);font-size:12px}
  @media (max-width:760px){.grid-2{grid-template-columns:1fr} .price,.mini{text-align:left} }
  @page{size:Letter;margin:0.5in}
  section,header,footer{page-break-inside:avoid}
  .frame-5x4{border:1px solid var(--line);border-radius:10px;overflow:hidden;aspect-ratio:5/4;background:#f8fafc}
  .ph-img{width:100%;height:100%;object-fit:cover;display:block}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>{{ADDRESS}}</h1>
        <p class="sub">{{SUBTITLE}}</p>
      </div>
      <div>
        <div class="price">{{PRICE}}</div>
        <div class="mini">EMD: $10,000 • Close: ASAP</div>
      </div>
    </header>

    <section class="card">
      <h2>Property Highlights</h2>
      <div class="pills">
        {{PILLS}}
      </div>
      <div class="grid-2">
        <div class="frame-5x4">
          <img class="ph-img" src="{{FRONT_PHOTO}}" alt="Front Photo">
        </div>
        <div class="frame-5x4">
          <img class="ph-img" src="{{SATELLITE_PHOTO}}" alt="Satellite / Lot">
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <h2>Terms</h2>
      <ul>
        <li>Purchase Price: <strong>{{PRICE}}</strong></li>
        <li>EMD: <strong>$10,000</strong></li>
        <li>Close: <strong>ASAP</strong></li>
        <li><strong>As-Is</strong>; buyer responsible for compliance after closing</li>
      </ul>
    </section>

    <a class="cta" href="{{COUNTY_PAGE_LINK}}" target="_blank" rel="noopener">County Page</a>

    <a class="cta" href="{{GOOGLE_DRIVE_LINK}}" target="_blank" rel="noopener">Photos and more info (Google Drive)</a>

    <section class="card" style="margin-top:12px">
      <h2>Nearby Sales (last ~3 months)</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <div class="pill">{{NEARBY_SALES_RANGE}}</div>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <h2>Area Map</h2>
      <div class="frame-5x4">
        <img class="ph-img" src="{{MAP_PHOTO}}" alt="Area Map">
      </div>
    </section>

    <footer>
      Buyer to verify all information, zoning/uses, and compliance requirements with the City.
      <br>Contact: Randy — BT Investments LLC — via text (425) 971-2331
    </footer>
  </div>
</body>
</html>`

export function buildListingPagePrompt(inputs: ListingPageInputs): string {
  const occupancyLine = inputs.occupancy
    ? `- Occupancy/Access: ${inputs.occupancy}`
    : '- Occupancy/Access: Not specified (omit from notable features)'

  return `You are producing a completed HTML one-pager for a real estate investment property marketing flyer.

All property data is provided below — do NOT search the web. Your job is to:
1. Write a SUBTITLE: one factual sentence highlighting the key facts (no fluff). Example: "Discounted off-market 3/1 on 6,970 sf lot."
2. Write NOTABLE FEATURES as pill items: the known property facts (beds/baths, sqft, lot size, year built, zoning) plus 1-3 short, neutral descriptive bullets if appropriate (e.g., "Big, flat backyard" — only if inferable from the facts). Each pill is a \`<div class="pill">...</div>\`. Include only pills you can confidently fill — no empty or placeholder pills.
3. Fill in the HTML template below with all provided values and your generated subtitle/pills.

Return ONLY the final HTML. No commentary, no code fences, no explanation.

---

## Property Data (use these exactly)

- Address: ${inputs.address}
- Price: ${inputs.price}
- Beds/Baths: ${inputs.beds} bed / ${inputs.baths} bath
- Square Footage: ${inputs.sqft.toLocaleString()} sf
- Lot Size: ${inputs.lotSize}
- Year Built: ${inputs.yearBuilt}
- Zoning: ${inputs.zoning} (buyer to verify)
${occupancyLine}
- Nearby Sales Range: ${inputs.nearbySalesRange}
- County Page Link: ${inputs.countyPageLink}
- Google Drive Photos Link: ${inputs.googleDriveLink}
- Front Photo URL: ${inputs.frontPhotoUrl}
- Satellite Photo URL: ${inputs.satellitePhotoUrl}
- Map Photo URL: ${inputs.mapPhotoUrl}

## Static (do not change)
- EMD: $10,000
- Close: ASAP
- Condition: As-Is; buyer responsible for compliance after closing
- Footer text and overall styling remain exactly as in the template.

## HTML Template

Replace the {{PLACEHOLDER}} tokens with real values. For {{PILLS}}, generate the appropriate \`<div class="pill">...</div>\` elements. For {{SUBTITLE}}, write your one-sentence subtitle.

${HTML_TEMPLATE}`
}
