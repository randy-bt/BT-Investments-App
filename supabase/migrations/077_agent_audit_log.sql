-- Audit log for the AI Agent bridge (spec 7/24, deliverable C.5): every
-- bridge call recorded - operation, parameters, result - reviewable by
-- Randy. Written by the bridge route via service role.

CREATE TABLE IF NOT EXISTS agent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  operation TEXT NOT NULL,
  params JSONB,
  success BOOLEAN NOT NULL,
  error TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS agent_audit_log_created_idx ON agent_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_audit_log_operation_idx ON agent_audit_log (operation);

ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read agent audit log"
  ON agent_audit_log FOR SELECT TO authenticated USING (true);
-- Writes only via the service-role client (the bridge).

GRANT SELECT ON agent_audit_log TO authenticated;
GRANT ALL ON agent_audit_log TO service_role;
