-- Real timestamps for the deal milestones (Randy 8/13).
--
-- "Deals Assigned" and "Deals Closed" were counted with
--   assignment_signed = true AND updated_at >= now() - 30 days
-- but updated_at moves whenever the row is touched for ANY reason, so it
-- measured "was assigned at some point AND was edited recently" rather than
-- "was assigned recently". The booleans record THAT something happened and
-- never WHEN, so there was nothing honest to filter on.
--
-- Named deal_closed_at, not closed_at: closed_at already exists and means
-- something different - archiveLead sets it when a LEAD is killed off.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assignment_signed_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_closed_at TIMESTAMPTZ;

-- A TRIGGER rather than logic in updateLead, because the app is not the only
-- writer: the AI Agent reaches these columns through the bridge, and anything
-- set straight in SQL would otherwise slip through uncounted.
CREATE OR REPLACE FUNCTION stamp_lead_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.assignment_signed IS TRUE AND COALESCE(OLD.assignment_signed, FALSE) IS FALSE THEN
    NEW.assignment_signed_at := now();
  ELSIF NEW.assignment_signed IS NOT TRUE AND COALESCE(OLD.assignment_signed, FALSE) IS TRUE THEN
    NEW.assignment_signed_at := NULL;
  END IF;

  IF NEW.closed IS TRUE AND COALESCE(OLD.closed, FALSE) IS FALSE THEN
    NEW.deal_closed_at := now();
  ELSIF NEW.closed IS NOT TRUE AND COALESCE(OLD.closed, FALSE) IS TRUE THEN
    NEW.deal_closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_lead_milestones ON leads;
CREATE TRIGGER trg_stamp_lead_milestones
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION stamp_lead_milestones();

CREATE INDEX IF NOT EXISTS leads_assignment_signed_at_idx ON leads (assignment_signed_at);
CREATE INDEX IF NOT EXISTS leads_deal_closed_at_idx ON leads (deal_closed_at);
