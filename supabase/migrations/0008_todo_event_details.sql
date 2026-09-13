-- Optional event details. Existing owner-only RLS continues to apply.
alter table public.todo_items
  add column if not exists end_date date,
  add column if not exists is_memo boolean not null default false,
  add column if not exists location text,
  add column if not exists url text,
  add column if not exists checklist jsonb not null default '[]'::jsonb;
