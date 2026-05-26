// Dump a listing_pages row for diagnosis. Usage:
//   node scripts/inspect-listing.mjs <slug>
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')

function loadEnv() {
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[m[1]] = v
  }
  return env
}

const env = loadEnv()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const slug = process.argv[2]
if (!slug) { console.error('Usage: node scripts/inspect-listing.mjs <slug>'); process.exit(1) }

const { data, error } = await supabase
  .from('listing_pages')
  .select('*')
  .eq('slug', slug)

if (error) { console.error('Query error:', error.message); process.exit(1) }
if (!data || data.length === 0) {
  console.log('No row found for slug:', slug)
  console.log('Searching for partial matches…')
  const { data: like } = await supabase.from('listing_pages').select('slug,address,page_type,style_id,is_active,created_at').like('slug', `%${slug.slice(0, 12)}%`).order('created_at', { ascending: false }).limit(10)
  console.log(like)
  process.exit(0)
}

for (const row of data) {
  console.log('=== Row ===')
  console.log('id:', row.id)
  console.log('slug:', row.slug)
  console.log('address:', row.address)
  console.log('page_type:', row.page_type)
  console.log('style_id:', row.style_id)
  console.log('is_active:', row.is_active)
  console.log('created_at:', row.created_at)
  console.log('html_content length:', (row.html_content ?? '').length)
  console.log('inputs:')
  console.log(JSON.stringify(row.inputs, null, 2))
}
