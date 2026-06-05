import { z } from 'zod'

export const SECTION_NAMES = ['AI', 'Tech & Business', 'Markets', 'Worth knowing'] as const
export const SectionName = z.enum(SECTION_NAMES)
export type SectionName = z.infer<typeof SectionName>

export const DigestItem = z.object({
  subject: z.string().min(1),
  detail: z.string().min(1),
})

export const DigestSection = z.object({
  name: SectionName,
  items: z.array(DigestItem).min(1),
})

export const DigestLead = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
})

export const DigestBodyJson = z.object({
  lead: DigestLead.nullable(),
  sections: z.array(DigestSection),
})

export type DigestBodyJson = z.infer<typeof DigestBodyJson>
export type DigestSection = z.infer<typeof DigestSection>
export type DigestItem = z.infer<typeof DigestItem>
export type DigestLead = z.infer<typeof DigestLead>

// JSON Schema mirror, used as Anthropic tool `input_schema`. Hand-written
// to avoid pulling in zod-to-json-schema for a single static shape.
export const DIGEST_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['lead', 'sections'],
  properties: {
    lead: {
      type: ['object', 'null'],
      required: ['title', 'body'],
      properties: {
        title: { type: 'string', minLength: 1 },
        body: { type: 'string', minLength: 1 },
      },
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'items'],
        properties: {
          name: { type: 'string', enum: [...SECTION_NAMES] },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['subject', 'detail'],
              properties: {
                subject: { type: 'string', minLength: 1 },
                detail: { type: 'string', minLength: 1 },
              },
            },
          },
        },
      },
    },
  },
} as const
