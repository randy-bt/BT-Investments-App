const UNDER_20 = [
  'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
]

const TENS = [
  '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY',
]

const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION']

function chunkToWords(n: number): string {
  if (n === 0) return ''
  const parts: string[] = []
  if (n >= 100) {
    parts.push(UNDER_20[Math.floor(n / 100)], 'HUNDRED')
    n %= 100
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)])
    n %= 10
  }
  if (n > 0) {
    if (n < 20) parts.push(UNDER_20[n])
  }
  return parts.join(' ')
}

// 200000 → "TWO HUNDRED THOUSAND"
export function wholeNumberToWords(n: number): string {
  if (n < 0) return `NEGATIVE ${wholeNumberToWords(-n)}`
  if (n === 0) return 'ZERO'

  const chunks: string[] = []
  let i = 0
  while (n > 0) {
    const chunk = n % 1000
    if (chunk > 0) {
      const words = chunkToWords(chunk)
      chunks.unshift(SCALES[i] ? `${words} ${SCALES[i]}` : words)
    }
    n = Math.floor(n / 1000)
    i++
  }
  return chunks.join(' ').trim()
}

// 200000 → "TWO HUNDRED THOUSAND DOLLARS ($200,000)"
export function currencyToWordsAndNumeric(n: number): string {
  const whole = Math.floor(n)
  const cents = Math.round((n - whole) * 100)
  const wholeWords = wholeNumberToWords(whole)
  const dollarLabel = whole === 1 ? 'DOLLAR' : 'DOLLARS'
  let words = `${wholeWords} ${dollarLabel}`
  if (cents > 0) {
    const centsWords = wholeNumberToWords(cents)
    const centsLabel = cents === 1 ? 'CENT' : 'CENTS'
    words = `${words} AND ${centsWords} ${centsLabel}`
  }
  const numeric = formatCurrencyNumeric(n)
  return `${words} (${numeric})`
}

export function formatCurrencyNumeric(n: number): string {
  const whole = Math.floor(n)
  const cents = Math.round((n - whole) * 100)
  const formatted = whole.toLocaleString('en-US')
  return cents > 0
    ? `$${formatted}.${cents.toString().padStart(2, '0')}`
    : `$${formatted}`
}

// "$10,000" → 10000 ; "10000" → 10000 ; "" → NaN
export function parseCurrency(input: string | number | undefined | null): number {
  if (input == null || input === '') return NaN
  if (typeof input === 'number') return input
  const cleaned = input.replace(/[^0-9.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? NaN : n
}
