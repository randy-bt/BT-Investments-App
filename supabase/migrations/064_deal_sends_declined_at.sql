-- Record when a deal send was declined.
-- Null until the ✕ is clicked; cleared back to null on undo.
ALTER TABLE deal_sends ADD COLUMN declined_at TIMESTAMPTZ;
