import { z } from 'zod'

const NeighborhoodPresetSchema = z.object({
  mode: z.literal('preset'),
  slug: z.string().min(1),
  label: z.string().min(1),
})

const NeighborhoodCustomSchema = z.object({
  mode: z.literal('custom'),
  photoPath: z.string().min(1),
  label: z.string().min(1),
})

const NeighborhoodHiddenSchema = z.object({
  mode: z.literal('hidden'),
})

export const NeighborhoodInputSchema = z.discriminatedUnion('mode', [
  NeighborhoodPresetSchema,
  NeighborhoodCustomSchema,
  NeighborhoodHiddenSchema,
])

export const ListingPageV2Inputs = z.object({
  address: z.string().min(1),
  price: z.string().min(1),
  beds: z.number().int().nonnegative(),
  baths: z.number().nonnegative(),
  sqft: z.number().int().nonnegative(),
  lotSize: z.string().min(1),
  yearBuilt: z.number().int(),
  zoning: z.string().min(1),
  occupancy: z.string().optional(),
  arvRange: z.string().min(1),
  countyPageLink: z.string().url(),
  googleDriveLink: z.string().url(),
  frontPhotoPath: z.string().min(1),
  satellitePhotoPath: z.string().min(1),
  mapPhotoPath: z.string().min(1).optional(),
  customSubtitle: z.string().optional(),

  cityEyebrow: z.string().min(1),
  highlightsEyebrow: z.string().default('At a Glance'),
  highlightBullets: z.array(z.string().min(1)).max(8).optional(),
  neighborhood: NeighborhoodInputSchema,
})

export type ListingPageV2InputsType = z.infer<typeof ListingPageV2Inputs>
