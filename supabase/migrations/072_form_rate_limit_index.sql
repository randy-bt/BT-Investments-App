-- Supports the DB-backed rate limit on /api/forms/submit (count of recent
-- submissions per IP). The in-memory limiter is per-serverless-instance and
-- therefore ineffective against concurrent bursts; the table is the only
-- shared state.
CREATE INDEX IF NOT EXISTS idx_form_submissions_ip_time
  ON public_form_submissions (ip_address, submitted_at DESC);
