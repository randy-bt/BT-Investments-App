// Update the googleDriveLink on a listing_pages row.
//   node scripts/update-listing-drive.mjs <slug> <newDriveUrl>
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const env = {}
for (const line of readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const [slug, url] = process.argv.slice(2)
if (!slug || !url) { console.error('Usage: node scripts/update-listing-drive.mjs <slug> <newDriveUrl>'); process.exit(1) }

const { data, error } = await supabase
  .from('listing_pages')
  .select('id, address, inputs')
  .eq('slug', slug)
  .single()
if (error || !data) { console.error('Not found:', slug, error?.message); process.exit(1) }

const newInputs = { ...data.inputs, googleDriveLink: url }
const { error: uErr } = await supabase.from('listing_pages').update({ inputs: newInputs }).eq('id', data.id)
if (uErr) { console.error('Update failed:', uErr.message); process.exit(1) }
console.log(`Updated ${data.address}`)
console.log(`  googleDriveLink -> ${url}`)
