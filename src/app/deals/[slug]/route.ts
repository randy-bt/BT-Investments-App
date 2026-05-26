import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

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
    .select('html_content')
    .eq('slug', slug)
    .eq('page_type', 'webpage')
    .eq('is_active', true)
    .single()

  if (error || !data) {
    // TEMPORARY DEBUG — remove once root cause is identified.
    return new Response(
      `Not found\nslug=${slug}\nerror=${error?.message ?? 'none'}\nhasUrl=${Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)}\nhasKey=${Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}\n`,
      { status: 404, headers: { 'Content-Type': 'text/plain' } },
    )
  }

  return new Response(data.html_content as string, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
