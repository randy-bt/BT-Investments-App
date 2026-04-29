const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
] as const

const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const

const MONTHS_PATTERN =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const MONTH_SHORT_RE = new RegExp(`\\b${MONTHS_PATTERN}\\b`, 'i')
const MONTH_DAY_RE = new RegExp(`\\b${MONTHS_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i')

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

export function ordinalSuffix(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'st'
  if (mod10 === 2 && mod100 !== 12) return 'nd'
  if (mod10 === 3 && mod100 !== 13) return 'rd'
  return 'th'
}

export function formatFriendly(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTH_LONG[m - 1]} ${d}${ordinalSuffix(d)}`
}

function monthNameToIndex(name: string): number {
  const lower = name.toLowerCase()
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (MONTH_NAMES[i].startsWith(lower) || lower.startsWith(MONTH_NAMES[i].slice(0, 3))) {
      return i
    }
  }
  return -1
}

export function parseFollowUpDate(html: string, today: string): string | null {
  const attrMatch = html.match(/data-fu-date="(\d{4}-\d{2}-\d{2})"/)
  if (attrMatch) return attrMatch[1]

  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')

  const md = text.match(MONTH_DAY_RE)
  if (md) {
    const monthIdx = monthNameToIndex(md[1])
    const day = parseInt(md[2], 10)
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      return resolveYear(monthIdx, day, today)
    }
  }

  const mo = text.match(MONTH_SHORT_RE)
  if (mo) {
    const monthIdx = monthNameToIndex(mo[1])
    if (monthIdx >= 0) return resolveYear(monthIdx, 1, today)
  }

  return null
}

function resolveYear(monthIdx: number, day: number, today: string): string {
  const [ty, tm] = today.split('-').map(Number)
  const candidateYear = monthIdx + 1 < tm ? ty + 1 : ty
  const mm = String(monthIdx + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${candidateYear}-${mm}-${dd}`
}
