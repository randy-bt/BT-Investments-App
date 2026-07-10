'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAdmin } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export type SignalAttachment = {
  kind: 'voice' | 'image' | 'file'
  storage_path: string
  mime: string
  size: number
  original_name: string
  duration_seconds?: number
}

export type SignalSubmission = {
  id: string
  sig_number: number
  created_at: string
  message_text: string | null
  name: string | null
  business_name: string | null
  email: string | null
  phone: string | null
  status: string
  attachments: SignalAttachment[]
}

export type SignalAttachmentWithUrl = SignalAttachment & { url: string | null }

export async function listSignalSubmissions(): Promise<ActionResult<SignalSubmission[]>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('signal_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as SignalSubmission[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Detail view: the submission plus 1-hour signed URLs for each attachment
// (the bucket is private; this is how voice notes play and images render).
export async function getSignalSubmission(
  id: string
): Promise<ActionResult<SignalSubmission & { attachmentsWithUrls: SignalAttachmentWithUrl[] }>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('signal_submissions')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return { success: false, error: error?.message ?? 'Not found' }

    const submission = data as SignalSubmission
    const admin = createAdminClient()
    const attachmentsWithUrls: SignalAttachmentWithUrl[] = await Promise.all(
      (submission.attachments ?? []).map(async (att) => {
        const { data: signed } = await admin.storage
          .from('signal-attachments')
          .createSignedUrl(att.storage_path, 3600)
        return { ...att, url: signed?.signedUrl ?? null }
      })
    )
    return { success: true, data: { ...submission, attachmentsWithUrls } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
