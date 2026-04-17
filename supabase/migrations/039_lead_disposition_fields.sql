-- Add disposition milestone and date fields to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS verbally_mutual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS psa_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assignment_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_escrow boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emd_deposited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emd_date text,
  ADD COLUMN IF NOT EXISTS closing_date text;
