-- Live dashboards (Randy 10/8, v11 step 1): open boards subscribe to
-- UPDATE events on dashboard_notes through Supabase Realtime and refetch
-- when one arrives. The event is only a signal; the board HTML is fetched
-- through the server action as before. RLS already lets any signed-in
-- user read the table, which is what the subscription needs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dashboard_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_notes;
  END IF;
END $$;
