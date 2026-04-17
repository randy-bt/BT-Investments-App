import { z } from 'zod'

export const leadPhoneSchema = z.object({
  phone_number: z.string(),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const leadEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const leadPropertySchema = z.object({
  address: z.string(),
})

export const createLeadSchema = z.object({
  name: z.string().optional().default(''),
  phones: z.array(leadPhoneSchema).optional().default([]),
  emails: z.array(leadEmailSchema).optional().default([]),
  properties: z.array(leadPropertySchema).optional().default([]),
  date_converted: z.string().optional().default(''),
  source_campaign_name: z.string().optional().default(''),
  handoff_notes: z.string().optional().default(''),
  mailing_address: z.string().optional(),
  occupancy_status: z.string().optional(),
  asking_price: z.string().optional(),
  selling_timeline: z.string().optional(),
})

export const updateLeadSchema = z.object({
  name: z.string().min(1),
  mailing_address: z.string().nullable(),
  occupancy_status: z.string().nullable(),
  asking_price: z.string().nullable(),
  selling_timeline: z.string().nullable(),
  condition: z.string().nullable(),
  our_current_offer: z.number().positive().nullable(),
  range: z.string().nullable(),
  photo_url: z.string().nullable(),
  handoff_notes: z.string(),
  source_campaign_name: z.string(),
  date_converted: z.string(),
  verbally_mutual: z.boolean(),
  psa_signed: z.boolean(),
  assignment_signed: z.boolean(),
  in_escrow: z.boolean(),
  emd_deposited: z.boolean(),
  closed: z.boolean(),
  emd_date: z.string().nullable(),
  closing_date: z.string().nullable(),
}).partial()

export const changeLeadStageSchema = z.object({
  stage: z.enum(['follow_up', 'lead', 'marketing_on_hold', 'marketing_active', 'assigned_in_escrow']),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
