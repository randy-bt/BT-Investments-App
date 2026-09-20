-- Split the dispositions board in two (Randy, Sept 2026), mirroring the
-- ACQ / AACQ pair on acquisitions:
--
--   dispositions     DSP Deals          app-written only
--   dispositions_b   DSP Investor Calls Aldo's, hand-edited
--
-- The module name `dispositions_b` is load-bearing beyond this app:
-- Geoffrey's Desk counter reads it by that exact name.
ALTER TABLE dashboard_notes DROP CONSTRAINT dashboard_notes_module_check;
ALTER TABLE dashboard_notes ADD CONSTRAINT dashboard_notes_module_check
  CHECK (module IN (
    'acquisitions', 'acquisitions_b', 'dispositions', 'dispositions_b',
    'investor_database', 'agent_outreach', 'investor_outreach',
    'agent_outreach_notes', 'investor_outreach_notes', 'deals_marketing',
    'jv_partners', 'agent_outreach_quick', 'investor_outreach_quick',
    'acq_outreach', 'follow_ups'
  ));

INSERT INTO dashboard_notes (module, content)
VALUES ('dispositions_b', '')
ON CONFLICT (module) DO NOTHING;

-- NO data migration here on purpose. Moving Aldo's existing 💰 lines out
-- of `dispositions` means parsing HTML blocks and de-duplicating by name,
-- which is miserable and untestable in SQL. reconcileDispoBoard does it in
-- application code on the first load after deploy: it lifts every 💰 block
-- out of the deals board and merges it into this one, skipping any name
-- already present, then rebuilds the deals board from dispo_queue and the
-- live rule. That is idempotent, covered by tests, and the same code path
-- that keeps the boards honest from then on.
--
-- The old READY TO SEND header needs no migration either: the deals board
-- is rebuilt wholesale, so the header simply ceases to exist.
