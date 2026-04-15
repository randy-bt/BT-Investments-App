import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import OpenAI from 'openai'
import { buildListingPagePrompt, type ListingPageInputs } from '@/lib/prompts/listing-page'

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as ListingPageInputs

    // Validate all required fields are present
    const required: (keyof ListingPageInputs)[] = [
      'address', 'price', 'beds', 'baths', 'sqft', 'lotSize',
      'yearBuilt', 'zoning', 'nearbySalesRange', 'countyPageLink',
      'googleDriveLink', 'frontPhotoUrl', 'satellitePhotoUrl', 'mapPhotoUrl',
    ]
    for (const field of required) {
      if (!body[field] && body[field] !== 0) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    const prompt = buildListingPagePrompt(body)

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const html = response.choices[0]?.message?.content?.trim() ?? ''

    if (!html) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 })
    }

    // Strip markdown code fences if the AI wraps the response
    const cleanHtml = html
      .replace(/^```html?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()

    return NextResponse.json({ success: true, html: cleanHtml })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}
