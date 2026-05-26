// One-shot helper to swap photos on a specific listing page. Reads
// SUPABASE creds from .env.local. Usage:
//   node scripts/replace-listing-photos.mjs <slug> [--front <file>] [--satellite <file>] [--hero <file>] [--map <file>]
// For front/satellite/map: writes to the storage path already recorded
// on the row (no DB update needed). For hero: writes to a new path and
// patches inputs.heroPhotoPath since legacy v2 rows have no hero.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { extname, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')

// Tiny .env parser so we don't need a dotenv dep
function loadEnv() {
  if (!existsSync(envPath)) throw new Error(`.env.local not found at ${envPath}`)
  const text = readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
  return env
}

const BUCKET = 'listing-page-photos'

function parseArgs(argv) {
  const out = { slug: null, files: {} }
  let i = 0
  while (i < argv.length) {
    const a = argv[i]
    if (a === '--front' || a === '--satellite' || a === '--hero' || a === '--map') {
      out.files[a.slice(2)] = argv[i + 1]
      i += 2
      continue
    }
    if (!out.slug) {
      out.slug = a
      i += 1
      continue
    }
    throw new Error(`Unexpected arg: ${a}`)
  }
  return out
}

function contentTypeFor(srcPath) {
  const ext = extname(srcPath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

async function main() {
  const { slug, files } = parseArgs(process.argv.slice(2))
  if (!slug || Object.keys(files).length === 0) {
    console.error('Usage: node scripts/replace-listing-photos.mjs <slug> [--front <file>] [--satellite <file>] [--hero <file>] [--map <file>]')
    process.exit(1)
  }

  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await supabase
    .from('listing_pages')
    .select('id, address, style_id, inputs')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    console.error('Listing not found for slug:', slug, error?.message)
    process.exit(1)
  }

  console.log('Listing:', data.address, '(id', data.id + ')')

  const inputs = { ...(data.inputs || {}) }
  // Slot → existing path key inside inputs. Falsy means we'll mint a
  // fresh path under the listing id and patch the JSONB.
  const slotToKey = {
    front: 'frontPhotoPath',
    satellite: 'satellitePhotoPath',
    map: 'mapPhotoPath',
    hero: 'heroPhotoPath',
  }
  let inputsChanged = false

  for (const [slot, srcPath] of Object.entries(files)) {
    if (!existsSync(srcPath)) {
      console.error(`Source file not found for ${slot}:`, srcPath)
      process.exit(1)
    }

    const inputsKey = slotToKey[slot]
    let destPath = inputs[inputsKey]
    if (!destPath) {
      // Slot wasn't previously populated (e.g., hero on a pre-existing
      // v2 row). Mint a fresh path under the listing id.
      const ext = extname(srcPath).toLowerCase() || '.jpg'
      destPath = `${data.id}/${slot}${ext}`
      inputs[inputsKey] = destPath
      inputsChanged = true
      console.log(`  ${slot}: minting new path ->`, destPath)
    }

    const buf = readFileSync(srcPath)
    const ct = contentTypeFor(srcPath)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(destPath, buf, { contentType: ct, upsert: true })
    if (upErr) {
      console.error(`Upload failed for ${slot}:`, upErr.message)
      process.exit(1)
    }
    console.log(`  ${slot.padEnd(9)} -> ${destPath}  (${buf.length.toLocaleString()} bytes, ${ct})`)
  }

  if (inputsChanged) {
    const { error: upErr } = await supabase
      .from('listing_pages')
      .update({ inputs })
      .eq('id', data.id)
    if (upErr) {
      console.error('Failed to patch inputs JSONB:', upErr.message)
      process.exit(1)
    }
    console.log('Updated inputs JSONB with new path(s).')
  }

  console.log('Done. The /deals/[slug] page will pick up the changes on next request.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
