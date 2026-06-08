// Strips a phone string to its bare digits for equality comparisons.
// Keeps the last 10 digits when a country code prefix is present so
// that "+1 555 123 4567" and "555-123-4567" normalize to the same key.

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D+/g, '')
  if (digits.length > 10) return digits.slice(-10)
  return digits
}
