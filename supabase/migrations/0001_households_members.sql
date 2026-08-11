-- tododo 0001 — households + members + membership helpers + membership-scoped RLS

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  color text not null default '#6366F1',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members(user_id);

-- SECURITY DEFINER membership helpers — bypass RLS so policies that call them
-- don't recurse into the tables they guard.
create or replace function public.is_household_member(hid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.household_members m where m.household_id = hid and m.user_id = auth.uid());
$$;

create or replace function public.is_household_admin(hid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_household_owner(hid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.shares_household_with(other uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Let members see co-members' profile rows (names/avatars in the member list).
create policy profiles_select_comember on public.profiles
  for select using (public.shares_household_with(id));

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- households
create policy households_member_select on public.households
  for select using (public.is_household_member(id));
create policy households_insert on public.households
  for insert with check (auth.uid() = created_by);
create policy households_update_admin on public.households
  for update using (public.is_household_admin(id));
create policy households_delete_owner on public.households
  for delete using (public.is_household_owner(id));

-- household_members (self-join happens via the create_household / accept_invite RPCs)
create policy members_select_comember on public.household_members
  for select using (public.is_household_member(household_id));
create policy members_insert_admin on public.household_members
  for insert with check (public.is_household_admin(household_id));
create policy members_update_admin on public.household_members
  for update using (public.is_household_admin(household_id));
create policy members_delete_self_or_admin on public.household_members
  for delete using (user_id = auth.uid() or public.is_household_admin(household_id));

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- Atomically create a household and make the caller its owner (avoids the
-- chicken-and-egg where no admin exists yet to satisfy members_insert_admin).
create or replace function public.create_household(p_name text) returns public.households
  language plpgsql security definer set search_path = public as $$
declare
  h public.households;
begin
  insert into public.households (name, created_by) values (p_name, auth.uid()) returning * into h;
  insert into public.household_members (household_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end;
$$;
