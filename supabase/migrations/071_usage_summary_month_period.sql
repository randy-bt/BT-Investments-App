-- 071_usage_summary_month_period.sql
-- Usage monitor periods change from Today / Last 30 Days / All Time to
-- Today / This Month / All Time (Randy prefers calendar months). Replaces
-- the rolling-30-day bucket in api_usage_summary with a Pacific-time
-- current-calendar-month bucket.

CREATE OR REPLACE FUNCTION api_usage_summary(tz text DEFAULT 'America/Los_Angeles')
RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH agg AS (
  SELECT provider, feature,
    sum(estimated_cost)::float8 AS cost_all,
    count(*)::int AS calls_all,
    coalesce(sum(estimated_cost) FILTER (WHERE date_trunc('month', created_at AT TIME ZONE tz) = date_trunc('month', now() AT TIME ZONE tz)), 0)::float8 AS cost_month,
    count(*) FILTER (WHERE date_trunc('month', created_at AT TIME ZONE tz) = date_trunc('month', now() AT TIME ZONE tz))::int AS calls_month,
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
