-- Custom enum types
CREATE TYPE user_role AS ENUM ('admin', 'member');
CREATE TYPE lead_stage AS ENUM ('follow_up', 'lead', 'marketing_on_hold', 'marketing_active', 'assigned_in_escrow');
CREATE TYPE entity_status AS ENUM ('active', 'closed');
CREATE TYPE entity_type AS ENUM ('lead', 'investor');

-- Shared trigger function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
