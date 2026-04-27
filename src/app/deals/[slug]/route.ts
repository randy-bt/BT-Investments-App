import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('listing_pages')
    .select('html_content')
    .eq('slug', slug)
    .eq('page_type', 'webpage')
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(data.html_content as string, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
