'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, Attachment } from '@/lib/types'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const MAX_ATTACHMENTS_PER_UPDATE = 10

export async function getUploadUrl(
  updateId: string,
  entityType: 'lead' | 'investor',
  entityId: string,
  fileName: string,
  fileSize: number
): Promise<ActionResult<{ path: string; signedUrl: string }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    if (fileSize > MAX_FILE_SIZE) {
      return { success: false, error: `File size exceeds maximum of 25 MB` }
    }

    // Check attachment count
    const supabase = await createServerClient()
    const { count } = await supabase
      .from('attachments')
      .select('*', { count: 'exact', head: true })
      .eq('update_id', updateId)

    if ((count ?? 0) >= MAX_ATTACHMENTS_PER_UPDATE) {
      return { success: false, error: `Maximum ${MAX_ATTACHMENTS_PER_UPDATE} attachments per update` }
    }

    const folder = entityType === 'lead' ? 'leads' : 'investors'
    const path = `${folder}/${entityId}/${updateId}/${fileName}`

    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUploadUrl(path)

    if (error) return { success: false, error: error.message }
    return { success: true, data: { path, signedUrl: data.signedUrl } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createAttachmentRecord(
  updateId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  storagePath: string
): Promise<ActionResult<Attachment>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('attachments')
      .insert({
        update_id: updateId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Attachment }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function listAttachments(updateId: string): Promise<ActionResult<Attachment[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('update_id', updateId)
      .order('created_at')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Attachment[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteAttachment(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Get storage path before deleting record
    const { data: attachment } = await supabase
      .from('attachments')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (!attachment) return { success: false, error: 'Attachment not found' }

    // Delete from storage
    await supabase.storage.from('attachments').remove([attachment.storage_path])

    // Delete record
    const { error } = await supabase.from('attachments').delete().eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getDownloadUrl(id: string): Promise<ActionResult<string>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data: attachment } = await supabase
      .from('attachments')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (!attachment) return { success: false, error: 'Attachment not found' }

    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(attachment.storage_path, 3600) // 1 hour

    if (error) return { success: false, error: error.message }
    return { success: true, data: data.signedUrl }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
