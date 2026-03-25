'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export type OutreachRecording = {
  id: string
  name: string
  category: 'agent' | 'investor'
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  created_by: string
  created_at: string
}

export async function listOutreachRecordings(): Promise<ActionResult<OutreachRecording[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('outreach_recordings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as OutreachRecording[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getRecordingUploadUrl(
  fileName: string,
  fileSize: number
): Promise<ActionResult<{ path: string; signedUrl: string }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const path = `outreach/${user.id}/${Date.now()}-${fileName}`

    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('attachments')
      .createSignedUploadUrl(path)

    if (error) return { success: false, error: error.message }
    return { success: true, data: { path, signedUrl: data.signedUrl } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createOutreachRecording(
  name: string,
  category: 'agent' | 'investor',
  fileName: string,
  fileType: string,
  fileSize: number,
  storagePath: string
): Promise<ActionResult<OutreachRecording>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('outreach_recordings')
      .insert({
        name,
        category,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as OutreachRecording }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteOutreachRecording(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data: recording } = await supabase
      .from('outreach_recordings')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (!recording) return { success: false, error: 'Recording not found' }

    const admin = createAdminClient()
    await admin.storage.from('attachments').remove([recording.storage_path])

    const { error } = await supabase.from('outreach_recordings').delete().eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getRecordingDownloadUrl(id: string): Promise<ActionResult<string>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data: recording } = await supabase
      .from('outreach_recordings')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (!recording) return { success: false, error: 'Recording not found' }

    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('attachments')
      .createSignedUrl(recording.storage_path, 3600)

    if (error) return { success: false, error: error.message }
    return { success: true, data: data.signedUrl }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
