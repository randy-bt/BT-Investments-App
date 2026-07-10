-- Signal intake (handoff 001): public lead-capture submissions for the
-- /signal front door. Rows are written by the service-role client from
-- /api/signal/submit; admins read them in /app/signals.

CREATE TABLE IF NOT EXISTS signal_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-facing sequence, rendered as SIG-001 / SIG-042 in emails + admin.
  sig_number SERIAL UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_text TEXT,
  name TEXT,
  business_name TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  ip_address TEXT,
  -- [{kind: 'voice'|'image'|'file', storage_path, mime, size, original_name, duration_seconds?}]
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Rate limiting counts recent submissions per IP (same pattern as
-- public_form_submissions, migration 072).
CREATE INDEX idx_signal_submissions_ip_time ON signal_submissions (ip_address, created_at DESC);
CREATE INDEX idx_signal_submissions_created ON signal_submissions (created_at DESC);

ALTER TABLE signal_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read signal submissions"
  ON signal_submissions FOR SELECT TO authenticated USING (true);
-- Writes go through the service-role client only (public API route).

-- MCP-applied migrations don't get default grants (see migration 073).
GRANT SELECT ON signal_submissions TO authenticated;
GRANT ALL ON signal_submissions TO service_role;

-- Private bucket for voice notes / photos / files. Access is only ever
-- via server-minted signed upload URLs (public visitors) and signed read
-- URLs (admin view).
INSERT INTO storage.buckets (id, name, public)
VALUES ('signal-attachments', 'signal-attachments', false)
ON CONFLICT (id) DO NOTHING;
