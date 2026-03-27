-- Add deals_marketing as a valid dashboard_notes module
ALTER TABLE dashboard_notes DROP CONSTRAINT dashboard_notes_module_check;
ALTER TABLE dashboard_notes ADD CONSTRAINT dashboard_notes_module_check
  CHECK (module IN ('acquisitions', 'dispositions', 'investor_database', 'deals_marketing'));

INSERT INTO dashboard_notes (module) VALUES ('deals_marketing');
