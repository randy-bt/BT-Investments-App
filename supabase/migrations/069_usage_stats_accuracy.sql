-- 069_usage_stats_accuracy.sql
-- Usage-monitor accuracy overhaul:
-- 1. leads.closed_at — a real close timestamp (updated_at recounted old
--    closed leads whenever they were edited). Backfilled with updated_at
--    as the best available approximation.
-- 2. SQL-side aggregation functions so stats are computed over ALL rows
--    (the JS aggregation fetched with no limit and silently got capped at
--    1000 rows by PostgREST — 92% of cost history was invisible) and
--    bucketed in a caller-supplied timezone instead of server UTC.

ALTER TABLE leads ADD COLUMN closed_at TIMESTAMPTZ;
UPDATE leads SET closed_at = updated_at WHERE status = 'closed' AND closed_at IS NULL;

-- Per-provider/feature cost aggregation for today / last 30 days / all time,
-- plus monthly totals. SECURITY INVOKER (default): respects RLS.
CREATE OR REPLACE FUNCTION api_usage_summary(tz text DEFAULT 'America/Los_Angeles')
RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH agg AS (
  SELECT provider, feature,
    sum(estimated_cost)::float8 AS cost_all,
    count(*)::int AS calls_all,
    coalesce(sum(estimated_cost) FILTER (WHERE created_at >= now() - interval '30 days'), 0)::float8 AS cost_30,
    count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS calls_30,
    coalesce(sum(estimated_cost) FILTER (WHERE (created_at AT TIME ZONE tz)::date = (now() AT TIME ZONE tz)::date), 0)::float8 AS cost_today,
    count(*) FILTER (WHERE (created_at AT TIME ZONE tz)::date = (now() AT TIME ZONE tz)::date)::int AS calls_today
  FROM api_usage_logs
  GROUP BY 1, 2
),
monthly AS (
  SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') AS mk,
         sum(estimated_cost)::float8 AS cost
  FROM api_usage_logs
  GROUP BY 1
)
SELECT jsonb_build_object(
  'features', (SELECT coalesce(jsonb_agg(to_jsonb(agg)), '[]'::jsonb) FROM agg),
  'monthly',  (SELECT coalesce(jsonb_agg(jsonb_build_object('key', mk, 'cost', cost) ORDER BY mk DESC), '[]'::jsonb) FROM monthly)
);
$$;

-- Business stats: 30-day rollups + per-month history, all aggregated in SQL.
-- leadsClosed30/monthly closes use closed_at (not updated_at). The two
-- deal fields still use updated_at — no dedicated timestamps exist for
-- assignment_signed/closed flags yet; acceptable approximation for now.
CREATE OR REPLACE FUNCTION business_stats_summary(tz text DEFAULT 'America/Los_Angeles')
RETURNS jsonb
LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
  'leadsAdded30',     (SELECT count(*) FROM leads WHERE created_at >= now() - interval '30 days'),
  'leadsClosed30',    (SELECT count(*) FROM leads WHERE status = 'closed' AND closed_at >= now() - interval '30 days'),
  'investorsAdded30', (SELECT count(*) FROM investors WHERE created_at >= now() - interval '30 days'),
  'activeMarketing',  (SELECT count(*) FROM listing_pages WHERE is_active = true),
  'dealsAssigned30',  (SELECT count(*) FROM leads WHERE assignment_signed = true AND updated_at >= now() - interval '30 days'),
  'dealsClosed30',    (SELECT count(*) FROM leads WHERE closed = true AND updated_at >= now() - interval '30 days'),
  'monthlyLeadsAdded',     (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads GROUP BY 1) x),
  'monthlyLeadsClosed',    (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(closed_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM leads WHERE status = 'closed' AND closed_at IS NOT NULL GROUP BY 1) x),
  'monthlyInvestorsAdded', (SELECT coalesce(jsonb_object_agg(mk, c), '{}'::jsonb) FROM (SELECT to_char(created_at AT TIME ZONE tz, 'YYYY-MM') mk, count(*) c FROM investors GROUP BY 1) x)
);
$$;
