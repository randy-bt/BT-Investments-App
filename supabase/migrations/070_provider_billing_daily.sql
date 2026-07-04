-- Actual billed costs pulled from provider billing APIs (Anthropic/OpenAI
-- admin keys). Org-wide amounts, one row per provider per day.
-- Written by the server with the service-role key; readable by signed-in users.

CREATE TABLE IF NOT EXISTS provider_billing_daily (
  provider TEXT NOT NULL,
  day DATE NOT NULL,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, day)
);

ALTER TABLE provider_billing_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read billing"
  ON provider_billing_daily FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE policies: writes go through the service-role client only.

GRANT SELECT ON provider_billing_daily TO authenticated;
GRANT ALL ON provider_billing_daily TO service_role;
