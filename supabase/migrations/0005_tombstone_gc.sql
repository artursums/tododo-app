-- tododo 0005 — daily GC of soft-deleted tombstones older than 90 days (pg_cron).
create extension if not exists pg_cron;

create or replace function public.cleanup_event_tombstones() returns void
  language sql security definer set search_path = public as $$
  delete from public.events where deleted_at is not null and deleted_at < now() - interval '90 days';
  delete from public.event_categories where deleted_at is not null and deleted_at < now() - interval '90 days';
$$;

select cron.schedule(
  'cleanup-event-tombstones',
  '17 3 * * *',
  $$select public.cleanup_event_tombstones()$$
);
