-- To-Do Calendar tables + Row Level Security (ported from the breathing app's
-- BA-015 schema). Durable, per-user store that lets entered items survive an
-- app reinstall. Apply via the SQL editor or `supabase db push`.
--
-- NOTE: this is the PERSONAL to-do store the ported calendar uses. It is
-- separate from the household-scoped calendars/events schema (0002), which the
-- shared-calendar milestone (M2) builds on.
--
-- ids are TEXT, not uuid: the app generates its own client-side ids
-- (timestamp+random strings) and uses stable, human-readable default category
-- ids ('cat-personal', …). The primary key is composite (user_id, id) so those
-- shared default ids never collide between accounts — each user owns their own
-- 'cat-personal'. user_id stays uuid (FK to auth.users).

create table if not exists public.todo_categories (
  id          text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null,
  "order"     int  not null default 0,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create table if not exists public.todo_items (
  id            text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  notes         text,
  category_id   text,
  date          date not null,
  all_day       boolean not null default true,
  start_time    text,
  end_time      text,
  completed     boolean not null default false,
  completed_at  timestamptz,
  reminder_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  primary key (user_id, id)
);

-- Index the common query: a user's rows by day.
create index if not exists todo_items_user_date_idx on public.todo_items (user_id, date);

-- Row Level Security: a user may only ever see/modify their own rows. This is the
-- load-bearing control — only the anon/publishable key ships in the app.
alter table public.todo_categories enable row level security;
alter table public.todo_items      enable row level security;

drop policy if exists todo_categories_owner on public.todo_categories;
create policy todo_categories_owner on public.todo_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists todo_items_owner on public.todo_items;
create policy todo_items_owner on public.todo_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
