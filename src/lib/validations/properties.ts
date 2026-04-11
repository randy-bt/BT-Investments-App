import { z } from 'zod'

export const addPropertySchema = z.object({
  address: z.string().min(1, 'Address is required'),
  apn: z.string().optional(),
  county: z.string().optional(),
  legal_description: z.string().optional(),
  year_built: z.number().int().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  sqft: z.number().int().positive().optional(),
  lot_size: z.string().optional(),
  property_type: z.string().optional(),
  owner_name: z.string().optional(),
  owner_mailing_address: z.string().optional(),
  redfin_value: z.number().positive().optional(),
  zillow_value: z.number().positive().optional(),
  rentcast_value: z.number().positive().optional(),
})

export const updatePropertySchema = addPropertySchema.partial()

export type AddPropertyInput = z.infer<typeof addPropertySchema>
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
