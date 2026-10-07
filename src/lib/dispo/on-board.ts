// ONE definition of "this listing page is on the dispositions board", shared
// by the Deals tab (dispo-deals.ts) and the Deals sent panel on an investor
// record (deal-sends.ts), so the two never disagree about which deals are
// live. Randy, Oct 7 2026: the green light on an investor record follows
// the "On index" switch, not is_active. Three dead pages were still
// is_active and lit up about ten investors each.
//
//   on the board  =  page is_active
//                AND page show_on_index
//                AND the lead has not been assigned or closed

export type BoardLead = {
  stage: string | null
  status: string | null
  deal_closed_at: string | null
} | null | undefined

export type BoardPage = {
  is_active: boolean | null | undefined
  show_on_index: boolean | null | undefined
}

/** The exit clause: assigned or closed is out of dispositions however long
 *  the page stays up. A page with no lead at all is judged on its toggles. */
export function leadOutOfDispo(lead: BoardLead): boolean {
  if (!lead) return false
  return (
    lead.stage === 'assigned_in_escrow' ||
    lead.status === 'closed' ||
    (lead.deal_closed_at !== null && lead.deal_closed_at !== undefined)
  )
}

export function listingOnBoard(page: BoardPage | null | undefined, lead: BoardLead): boolean {
  if (!page) return false
  return page.is_active === true && page.show_on_index === true && !leadOutOfDispo(lead)
}
