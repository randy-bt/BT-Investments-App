-- Business stats by CALENDAR MONTH (Randy 8/13): the tiles show the month you
-- are in and reset to 0 on the 1st. The per-month history now covers every
-- stat, so nothing is lost at the rollover.
--
-- Three correctness fixes at the same time:
--   * dealsAssigned / dealsClosed key off the milestone timestamps added in
--     080 instead of updated_at, which moved on any edit.
--   * activeMarketing now matches the deal index exactly (is_active AND
--     show_on_index). It counted is_active alone.
--   * leadsClosed renamed leadsArchived. Same query, but the old name collided
--     with "Deals Closed", an entirely different event.
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
  'dealsAssignedMonth', (SELECT count(*) FROM leads, bounds WHERE assignment_signed_at >= bounds.month_start),
  'dealsClosedMonth',   (SELECT count(*) FROM leads, bounds WHERE deal_closed_at >= bounds.month_start),

  'monthlyLeadsAdded',     (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads GROUP BY 1) x),
  'monthlyLeadsArchived',  (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(closed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE status = 'closed' AND closed_at IS NOT NULL GROUP BY 1) x),
  'monthlyInvestorsAdded', (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM investors GROUP BY 1) x),
  'monthlyDealsAssigned',  (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(assignment_signed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE assignment_signed_at IS NOT NULL GROUP BY 1) x),
  'monthlyDealsClosed',    (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(deal_closed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE deal_closed_at IS NOT NULL GROUP BY 1) x)
);
$function$;
