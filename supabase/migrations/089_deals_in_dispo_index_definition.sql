-- ONE definition of "live" (Randy via analyst, 8/15): a deal is in dispo
-- when it is TOGGLED ON on the deals index, the visibility Randy actually
-- controls. dealsInDispo previously counted leads by stage
-- (marketing_active), which could disagree with the LIVE DEALS section
-- once that section filtered to index visibility - two rules that drift.
-- Now both count listing_pages(is_active AND show_on_index) + marketing
-- JV deals, so the homepage number always equals the DSP2 card count.
-- (Function body otherwise unchanged from 085; see repo history.)
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
  'dealsInDispo',       (SELECT (SELECT count(*) FROM listing_pages WHERE is_active = true AND show_on_index = true)
                              + (SELECT count(*) FROM jv_deals WHERE status = 'marketing')),
  'dealsAssignedMonth', (SELECT count(*) FROM leads, bounds WHERE assignment_signed_at >= bounds.month_start),
  'dealsClosedMonth',   (SELECT count(*) FROM leads, bounds WHERE deal_closed_at >= bounds.month_start),

  'monthlyLeadsAdded',     (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads GROUP BY 1) x),
  'monthlyLeadsArchived',  (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(closed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE status = 'closed' AND closed_at IS NOT NULL GROUP BY 1) x),
  'monthlyInvestorsAdded', (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM investors GROUP BY 1) x),
  'monthlyDealsAssigned',  (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(assignment_signed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE assignment_signed_at IS NOT NULL GROUP BY 1) x),
  'monthlyDealsClosed',    (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(deal_closed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE deal_closed_at IS NOT NULL GROUP BY 1) x)
);
$function$;
