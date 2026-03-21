import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

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

    const folder = entityType === 'lead' ? 'leads' : 'investors'
    const path = `${folder}/${entityId}/${updateId}/${file.name}`

    // Upload to storage via admin client
    const admin = createAdminClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from('attachments')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
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
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
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
