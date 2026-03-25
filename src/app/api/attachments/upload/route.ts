import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { execFile } from 'child_process'
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

function isHeic(fileName: string, fileType: string): boolean {
  const name = fileName.toLowerCase()
  return (
    fileType === 'image/heic' ||
    fileType === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer<ArrayBuffer>> {
  const dir = await mkdtemp(join(tmpdir(), 'heic-'))
  const inputPath = join(dir, 'input.heic')
  const outputPath = join(dir, 'output.jpg')
  try {
    await writeFile(inputPath, buffer)
    await execFileAsync('sips', ['-s', 'format', 'jpeg', inputPath, '--out', outputPath])
    return Buffer.from(await readFile(outputPath))
  } finally {
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const updateId = formData.get('updateId') as string | null
    const entityType = formData.get('entityType') as string | null
    const entityId = formData.get('entityId') as string | null

    if (!file || !updateId || !entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 25 MB limit' },
        { status: 400 }
      )
    }

    let buffer: Buffer<ArrayBuffer> = Buffer.from(await file.arrayBuffer())
    let fileName = file.name
    let fileType = file.type || 'application/octet-stream'

    // Convert HEIC/HEIF to JPEG server-side using macOS sips
    if (isHeic(fileName, fileType)) {
      try {
        buffer = await convertHeicToJpeg(buffer)
        fileName = fileName.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
        fileType = 'image/jpeg'
      } catch {
        // If conversion fails, upload original
      }
    }

    const folder = entityType === 'lead' ? 'leads' : 'investors'
    const path = `${folder}/${entityId}/${updateId}/${fileName}`

    // Upload to storage via admin client
    const admin = createAdminClient()

    const { error: uploadError } = await admin.storage
      .from('attachments')
      .upload(path, buffer, {
        contentType: fileType,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      )
    }

    // Create attachment record
    const supabase = await createServerClient()
    const { data, error: dbError } = await supabase
      .from('attachments')
      .insert({
        update_id: updateId,
        file_name: fileName,
        file_type: fileType,
        file_size: buffer.length,
        storage_path: path,
      })
      .select()
      .single()

    if (dbError) {
      // Clean up uploaded file
      await admin.storage.from('attachments').remove([path])
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
