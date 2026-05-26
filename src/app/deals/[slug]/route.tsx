import { renderToStaticMarkup } from 'react-dom/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ListingPageV2 } from '@/components/listing-pages/ListingPageV2'
import { ListingPageV2Inputs } from '@/lib/validations/listing-page-v2'

export const dynamic = 'force-dynamic'

// Minimal standalone HTML shell for v2 listing pages. v2 is a React
// Server Component rendered at request time, so we need to bring along
// the marketing fonts + the --mkt-* CSS tokens it depends on (those
// tokens live in globals.css under .marketing-scope, but this route
// returns raw HTML outside the Next.js app shell).
function wrapV2Html(bodyHtml: string, address: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(address)} — BT Investments</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { --font-cormorant: 'Cormorant Garamond'; --font-inter: 'Inter'; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #ffffff; font-family: 'Inter', system-ui, sans-serif; }
  .marketing-scope {
    --mkt-cream: #ffffff;
    --mkt-cream-dim: #f0eee5;
    --mkt-dark: #161614;
    --mkt-dark-soft: #1d1d1a;
    --mkt-olive: #585732;
    --mkt-olive-light: #747250;
    --mkt-olive-pale: #cdcb95;
    --mkt-text-on-light: #1a1a17;
    --mkt-text-on-dark: #faf9f4;
    --mkt-muted-light: #3d3a35;
    --mkt-muted-dark: #b8b0a0;
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Admin client bypasses RLS — this route is the public marketing
  // view of the flyer, accessed without auth from btinvestments.co.
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('listing_pages')
    .select('address, html_content, style_id, inputs')
    .eq('slug', slug)
    .eq('page_type', 'webpage')
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return new Response('Not found', { status: 404 })
  }

  if (data.style_id === 'listing-page-v2') {
    const parsed = ListingPageV2Inputs.safeParse(data.inputs)
    if (!parsed.success) {
      return new Response('Not found', { status: 404 })
    }
    const bodyHtml = renderToStaticMarkup(<ListingPageV2 inputs={parsed.data} />)
    return new Response(wrapV2Html(bodyHtml, data.address as string), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    })
  }

  return new Response(data.html_content as string, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
