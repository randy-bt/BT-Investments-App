export type ParsedLead = {
  date: string
  name: string
  address: string
  phone: string
  campaign: string
}

// Parses a cold-call audio filename in the BT Investments onboarding
// convention into the fields used to autofill a new lead. Returns null
// if the filename doesn't match the expected structure.
//
// Expected format:
//   "M.D <first> <last...> <age> - <address> - <phone> - <campaign>.ext"
// Example:
//   "6.7 John Doe 45 - 123 Main St Seattle WA - 555-1234 - Direct Mail.mp3"
//
// The date's year is set to the current calendar year — onboarding
// always happens within the same year as the cold call.
export function parseOnboardingFilename(filename: string): ParsedLead | null {
  const baseName = filename.replace(/\.[^/.]+$/, '')
  const parts = baseName.split(' - ')
  if (parts.length !== 4) return null

  const [leadInfo, address, phone, campaign] = parts
  const tokens = leadInfo.trim().split(/\s+/)
  if (tokens.length < 3) return null

  const datePart = tokens[0]
  const agePart = tokens[tokens.length - 1]
  const nameTokens = tokens.slice(1, -1)

  const dateMatch = datePart.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (!dateMatch) return null
  if (!/^\d+$/.test(agePart)) return null
  if (nameTokens.length === 0) return null

  const month = dateMatch[1].padStart(2, '0')
  const day = dateMatch[2].padStart(2, '0')
  const year = new Date().getFullYear()

  return {
    date: `${year}-${month}-${day}`,
    name: nameTokens.join(' '),
    address: address.trim(),
    phone: phone.trim(),
    campaign: campaign.trim(),
  }
}
