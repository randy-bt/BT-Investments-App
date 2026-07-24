-- Delivery tracking for deal sends (spec 7/24, option B): plumbing ships
-- now; per-send fields stay dormant until the in-app deal email exists.
-- The Resend webhook fills delivery fields by resend_email_id and flags
-- hard-bounced investor emails by address.

ALTER TABLE deal_sends
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_type TEXT,
  ADD COLUMN IF NOT EXISTS bounce_message TEXT;

CREATE INDEX IF NOT EXISTS deal_sends_resend_email_id_idx
  ON deal_sends(resend_email_id) WHERE resend_email_id IS NOT NULL;

ALTER TABLE investors
  ADD COLUMN IF NOT EXISTS email_bounced BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_bounce_reason TEXT;
