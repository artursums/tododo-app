-- tododo 0004 — enable Supabase Realtime on the shared tables.
-- Realtime respects RLS, so a client only receives rows for households it belongs to.

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_categories;
alter publication supabase_realtime add table public.calendars;
alter publication supabase_realtime add table public.household_members;
