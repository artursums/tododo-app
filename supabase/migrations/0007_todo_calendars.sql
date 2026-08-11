-- Multi-calendar support (TimeTree-style): a per-user calendars table + a
-- calendar_id column on todo_items. Same conventions as 0006 (text client ids,
-- composite (user_id, id) PK, owner-only RLS).
--
-- NOTE: this covers the PERSONAL multi-calendar store (reinstall durability).
-- Cross-user SHARED calendars build on the household schema (0001–0003) and
-- land with the M1/M2 backend wiring.

create table if not exists public.todo_calendars (
  id          text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null,
  emoji       text not null default '🗓️',
  "order"     int  not null default 0,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

alter table public.todo_items
  add column if not exists calendar_id text;

alter table public.todo_calendars enable row level security;

drop policy if exists todo_calendars_owner on public.todo_calendars;
create policy todo_calendars_owner on public.todo_calendars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
