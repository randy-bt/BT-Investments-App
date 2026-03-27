ALTER TABLE investors ADD COLUMN updated_by UUID REFERENCES users(id);

-- Backfill: set updated_by to created_by for existing rows
UPDATE investors SET updated_by = created_by WHERE updated_by IS NULL;
