import { z } from 'zod'

export const leadPhoneSchema = z.object({
  phone_number: z.string().min(1, 'Phone number is required'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const leadEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const leadPropertySchema = z.object({
  address: z.string().min(1, 'Address is required'),
})

export const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phones: z.array(leadPhoneSchema).min(1, 'At least one phone number is required'),
  emails: z.array(leadEmailSchema).optional().default([]),
  properties: z.array(leadPropertySchema).min(1, 'At least one property is required'),
  date_converted: z.string().min(1, 'Date converted is required'),
  source_campaign_name: z.string().min(1, 'Source campaign name is required'),
  handoff_notes: z.string().min(1, 'Handoff notes are required'),
  mailing_address: z.string().optional(),
  occupancy_status: z.string().optional(),
  asking_price: z.number().positive().optional(),
  selling_timeline: z.string().optional(),
})

export const updateLeadSchema = z.object({
  name: z.string().min(1),
  mailing_address: z.string().nullable(),
  occupancy_status: z.string().nullable(),
  asking_price: z.number().positive().nullable(),
  selling_timeline: z.string().nullable(),
  condition: z.string().nullable(),
  our_current_offer: z.number().positive().nullable(),
  range: z.string().nullable(),
  handoff_notes: z.string(),
  source_campaign_name: z.string(),
  date_converted: z.string(),
}).partial()

export const changeLeadStageSchema = z.object({
  stage: z.enum(['follow_up', 'lead', 'marketing_on_hold', 'marketing_active', 'assigned_in_escrow']),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
