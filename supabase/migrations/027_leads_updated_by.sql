ALTER TABLE leads ADD COLUMN updated_by UUID REFERENCES users(id);

-- Backfill: set updated_by to created_by for existing rows
UPDATE leads SET updated_by = created_by WHERE updated_by IS NULL;
