-- Add investor_database as a valid dashboard_notes module
ALTER TABLE dashboard_notes DROP CONSTRAINT dashboard_notes_module_check;
ALTER TABLE dashboard_notes ADD CONSTRAINT dashboard_notes_module_check
  CHECK (module IN ('acquisitions', 'dispositions', 'investor_database'));

INSERT INTO dashboard_notes (module) VALUES ('investor_database');
