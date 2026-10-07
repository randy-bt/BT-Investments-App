// Order of the Deals sent panel on an investor record (Randy, Oct 7 2026):
// green (live, not declined) rows first, newest sent first; then every grey
// row (retired or declined), also newest first. Sorted at render time, so a
// row that is marked declined moves to the grey group on the next render.

export type DealsSentOrderRow = { page_active: boolean; declined: boolean; sent_at: string }

export function isLiveRow(row: DealsSentOrderRow): boolean {
  return row.page_active && !row.declined
}

export function sortDealsSent<T extends DealsSentOrderRow>(rows: readonly T[]): T[] {
  const time = (r: T) => new Date(r.sent_at).getTime() || 0
  return [...rows].sort((a, b) => {
    const la = isLiveRow(a) ? 0 : 1
    const lb = isLiveRow(b) ? 0 : 1
    if (la !== lb) return la - lb
    return time(b) - time(a)
  })
}
