-- jv_deals.status is an ENUM (jv_deal_status), not free text - 084's note
-- claiming otherwise was wrong, caught when this function first referenced
-- 'marketing' and Postgres rejected the value. Applied as its own
-- statement because ADD VALUE cannot share a transaction with first use.
ALTER TYPE jv_deal_status ADD VALUE IF NOT EXISTS 'marketing';

-- Business stats gain the dispo pipeline counters (agent-requests #14.6).
--
-- Two live counts join the row, mid-row in pipeline order:
--   readyForDispo - unsent queue rows (dispo_queue status 'ready')
--   dealsInDispo  - leads in marketing_active + JV deals in 'marketing'.
--     Both are status-driven, so nothing is manually maintained: the send
--     cascade flips JV deals to 'marketing', stage changes move leads.
--
-- Unlike the four monthly tiles these do not reset on the 1st - they are
-- "right now" numbers, same nature as the old activeMarketing.
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
  'dealsInDispo',       (SELECT (SELECT count(*) FROM leads WHERE stage = 'marketing_active')
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
