-- tododo 0002 — calendars, event categories, events (household-scoped, offline-sync shape)

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null default 'Calendar',
  color text not null default '#6366F1',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendars_household_idx on public.calendars(household_id);

create table if not exists public.event_categories (
  household_id uuid not null references public.households on delete cascade,
  id text not null,                 -- client-generated id
  name text not null,
  color text not null,
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,           -- soft-delete tombstone (LWW)
  primary key (household_id, id)
);

create table if not exists public.events (
  household_id uuid not null references public.households on delete cascade,
  id text not null,                 -- client-generated id
  calendar_id uuid references public.calendars on delete set null,
  title text not null,
  notes text,
  date date not null,               -- YYYY-MM-DD local day key
  all_day boolean not null default true,
  start_time text,                  -- 'HH:mm' or null
  end_time text,
  category_id text,
  color text,
  assignee_id uuid references auth.users on delete set null,
  created_by uuid references auth.users on delete set null,
  completed boolean not null default false,
  reminder_minutes int,             -- minutes-before, or null
  recurrence jsonb,                 -- v1: {freq, interval, ...}; null = one-off
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,           -- soft-delete tombstone (LWW)
  primary key (household_id, id)
);
create index if not exists events_household_date_idx on public.events(household_id, date);

alter table public.calendars enable row level security;
alter table public.event_categories enable row level security;
alter table public.events enable row level security;

-- Any member of the household has full CRUD on its calendar data.
create policy calendars_member_all on public.calendars
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy event_categories_member_all on public.event_categories
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy events_member_all on public.events
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create trigger calendars_set_updated_at
  before update on public.calendars
  for each row execute function public.set_updated_at();
