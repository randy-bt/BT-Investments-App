-- Full-text search GIN indexes
CREATE INDEX leads_name_search_idx ON leads USING GIN (to_tsvector('english', name));
CREATE INDEX investors_name_search_idx ON investors USING GIN (to_tsvector('english', name));
CREATE INDEX properties_address_search_idx ON properties USING GIN (to_tsvector('english', address));
CREATE INDEX investors_locations_search_idx ON investors USING GIN (to_tsvector('english', locations_of_interest));
