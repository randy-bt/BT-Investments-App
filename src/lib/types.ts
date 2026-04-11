// Standard response shape for all Server Actions
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// Pagination
export type PaginationParams = {
  page?: number
  pageSize?: number
}

export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// Database row types (match migration schema)
export type UserRole = 'admin' | 'member'
export type LeadStage = 'follow_up' | 'lead' | 'marketing_on_hold' | 'marketing_active' | 'assigned_in_escrow'
export type EntityStatus = 'active' | 'closed' | 'inactive' | 'onboarding' | 'archived'
export type EntityType = 'lead' | 'investor'

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export type Lead = {
  id: string
  name: string
  mailing_address: string | null
  occupancy_status: string | null
  asking_price: string | null
  selling_timeline: string | null
  condition: string | null
  our_current_offer: number | null
  range: string | null
  photo_url: string | null
  source_campaign_name: string | null
  handoff_notes: string | null
  date_converted: string | null
  stage: LeadStage
  status: EntityStatus
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type LeadWithAddress = Lead & { address?: string; updated_by_name?: string }

export type LeadPhone = {
  id: string
  lead_id: string
  phone_number: string
  label: string | null
  is_primary: boolean
  created_at: string
}

export type LeadEmail = {
  id: string
  lead_id: string
  email: string
  label: string | null
  is_primary: boolean
  created_at: string
}

export type Property = {
  id: string
  lead_id: string
  address: string
  apn: string | null
  county: string | null
  legal_description: string | null
  year_built: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_size: string | null
  property_type: string | null
  owner_name: string | null
  owner_mailing_address: string | null
  redfin_value: number | null
  zillow_value: number | null
  rentcast_value: number | null
  created_at: string
  updated_at: string
}

export type Investor = {
  id: string
  name: string
  company: string | null
  locations_of_interest: string
  deals_notes: string | null
  status: EntityStatus
  created_by: string
  created_at: string
  updated_at: string
  updated_by: string | null
  updated_by_name?: string | null
}

export type InvestorPhone = {
  id: string
  investor_id: string
  phone_number: string
  label: string | null
  is_primary: boolean
  created_at: string
}

export type InvestorEmail = {
  id: string
  investor_id: string
  email: string
  label: string | null
  is_primary: boolean
  created_at: string
}

export type Update = {
  id: string
  entity_type: EntityType
  entity_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
}

export type Attachment = {
  id: string
  update_id: string
  file_name: string
  file_type: string | null
  file_size: number | null
  storage_path: string
  created_at: string
}

export type DashboardNote = {
  id: string
  module: 'acquisitions' | 'dispositions'
  content: string
  updated_at: string
  updated_by: string | null
}

export type DashboardNoteVersion = {
  id: string
  dashboard_note_id: string
  content: string
  edited_by: string
  created_at: string
}

export type PublicFormSubmission = {
  id: string
  form_name: string
  data: Record<string, unknown>
  submitted_at: string
  ip_address: string | null
  notified: boolean
}

// Lead with all relations loaded
export type LeadWithRelations = Lead & {
  phones: LeadPhone[]
  emails: LeadEmail[]
  properties: Property[]
}

export type InvestorLocation = {
  id: string
  investor_id: string
  location_name: string
  created_at: string
}

// Investor with all relations loaded
export type InvestorWithRelations = Investor & {
  phones: InvestorPhone[]
  emails: InvestorEmail[]
  locations: InvestorLocation[]
}

// Search results
export type SearchResults = {
  leads: (Pick<Lead, 'id' | 'name' | 'status' | 'stage'> & { address?: string })[]
  investors: (Pick<Investor, 'id' | 'name' | 'status'> & { phone?: string })[]
  properties: (Pick<Property, 'id' | 'address' | 'lead_id'> & { lead_name: string })[]
}
