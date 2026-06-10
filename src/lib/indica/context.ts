export type EntityContextInput = {
  entityType: 'lead' | 'investor'
  entity: {
    id: string
    name: string
    fields: Record<string, string | number | null | undefined>
  }
  activity: Array<{
    id: string
    author_name: string
    created_at: string // ISO
    content: string
  }>
  attachments: Array<{
    id: string
    file_name: string
    file_type: string | null
  }>
  transcripts: Array<{
    attachment_id: string
    transcript_text: string
  }>
  chatHistory: Array<{
    role: 'user' | 'assistant'
    author_name: string | null // user's display name; null for assistant
    content: string
    created_at: string
  }>
}

export type EntityContextOutput = {
  staticContext: string // record + activity + attachments + transcripts (cacheable)
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>
}

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function formatFields(fields: Record<string, string | number | null | undefined>): string {
  const lines: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined || v === '') {
      lines.push(`${k}: (none)`)
    } else {
      lines.push(`${k}: ${v}`)
    }
  }
  return lines.join('\n')
}

export function buildEntityContext(input: EntityContextInput): EntityContextOutput {
  const sections: string[] = []

  sections.push(
    `# ${input.entityType.toUpperCase()} RECORD\n\nName: ${input.entity.name}\n${formatFields(input.entity.fields)}`,
  )

  if (input.activity.length > 0) {
    const lines = input.activity.map(
      (a) => `[${isoDateOnly(a.created_at)} · ${a.author_name}]\n${a.content}`,
    )
    sections.push(`# ACTIVITY FEED\n\n${lines.join('\n\n')}`)
  } else {
    sections.push(`# ACTIVITY FEED\n\n(no activity)`)
  }

  if (input.attachments.length > 0) {
    const lines = input.attachments.map(
      (a) => `- ${a.file_name}${a.file_type ? ` (${a.file_type})` : ''}`,
    )
    sections.push(`# ATTACHMENTS\n\n${lines.join('\n')}`)
  }

  const transcripts = input.transcripts
  if (transcripts.length > 0) {
    const attachmentNameById = new Map(input.attachments.map((a) => [a.id, a.file_name]))
    const blocks = transcripts.map((t) => {
      const fileName = attachmentNameById.get(t.attachment_id) ?? '(unknown audio file)'
      return `## ${fileName}\n\n${t.transcript_text}`
    })
    sections.push(`# CALL TRANSCRIPTS\n\n${blocks.join('\n\n---\n\n')}`)
  }

  const staticContext = sections.join('\n\n---\n\n')

  const chatMessages = input.chatHistory.map((m) => ({
    role: m.role,
    content:
      m.role === 'user' && m.author_name ? `[${m.author_name}] ${m.content}` : m.content,
  }))

  return { staticContext, chatMessages }
}
