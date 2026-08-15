-- Deals in Dispo, EVENT-BASED (Randy's redefinition; JV status question
-- delegated to and decided by the analyst, 8/15).
--
-- A listing deal is "in dispo" when sends exist (deal_sends), the page is
-- toggled visible on the index, AND the lead has not exited (assigned in
-- escrow / closed - without the exit clause a sold deal counts forever,
-- since pages outlive assignments). A JV deal is in dispo when sends
-- exist and it is still status 'interested'.
--
-- The 'marketing' JV status is RETIRED (analyst's call): it encoded
-- something derivable - whether sends exist - at the cost of a transition
-- that can desync, and Randy's mental model is that an Interested deal
-- stays Interested until it dies. The enum value stays defined but
-- unused; any stragglers migrate back to 'interested' (0 at apply time).
--
-- Net shape: Ready for Dispo (queued, unsent) and Deals in Dispo (sent,
-- being worked) are sequential with no overlap, and each empties on its
-- own. DSP2's Live Deals uses this same rule in code.

UPDATE jv_deals SET status = 'interested' WHERE status = 'marketing';

CREATE OR REPLACE FUNCTION public.business_stats_summary(tz text DEFAULT 'America/Los_Angeles'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
WITH bounds AS (
  SELECT (date_trunc('month', (now() AT TIME ZONE tz)) AT TIME ZONE tz) AS month_start
)
SELECT jsonb_build_object(
  'monthKey',           to_char(now() AT TIME ZONE tz, 'YYYY-MM'),
  'monthLabel',         to_char(now() AT TIME ZONE tz, 'FMMonth YYYY'),

  'leadsAddedMonth',    (SELECT count(*) FROM leads, bounds WHERE created_at >= bounds.month_start),
  'leadsArchivedMonth', (SELECT count(*) FROM leads, bounds WHERE status = 'closed' AND closed_at >= bounds.month_start),
  'investorsAddedMonth',(SELECT count(*) FROM investors, bounds WHERE created_at >= bounds.month_start),
  'activeMarketing',    (SELECT count(*) FROM listing_pages WHERE is_active = true AND show_on_index = true),
  'readyForDispo',      (SELECT count(*) FROM dispo_queue WHERE status = 'ready'),
  'dealsInDispo',       (
    (SELECT count(*) FROM listing_pages lp
      LEFT JOIN leads l ON l.id = lp.lead_id
      WHERE lp.is_active = true AND lp.show_on_index = true
        AND EXISTS (SELECT 1 FROM deal_sends ds WHERE ds.listing_page_id = lp.id)
        AND (l.id IS NULL OR (
          l.stage <> 'assigned_in_escrow'
          AND l.status <> 'closed'
          AND l.deal_closed_at IS NULL
        )))
    + (SELECT count(*) FROM jv_deals jv
        WHERE jv.status = 'interested'
          AND EXISTS (SELECT 1 FROM dispo_queue q WHERE q.jv_deal_id = jv.id AND q.status = 'sent'))
  ),
  'dealsAssignedMonth', (SELECT count(*) FROM leads, bounds WHERE assignment_signed_at >= bounds.month_start),
  'dealsClosedMonth',   (SELECT count(*) FROM leads, bounds WHERE deal_closed_at >= bounds.month_start),

  'monthlyLeadsAdded',     (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads GROUP BY 1) x),
  'monthlyLeadsArchived',  (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(closed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE status = 'closed' AND closed_at IS NOT NULL GROUP BY 1) x),
  'monthlyInvestorsAdded', (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM investors GROUP BY 1) x),
  'monthlyDealsAssigned',  (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(assignment_signed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE assignment_signed_at IS NOT NULL GROUP BY 1) x),
  'monthlyDealsClosed',    (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(deal_closed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE deal_closed_at IS NOT NULL GROUP BY 1) x)
);
$function$;
