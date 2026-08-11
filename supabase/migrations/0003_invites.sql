-- tododo 0003 — invite links + create/accept RPCs

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  role text not null default 'member' check (role in ('admin', 'member')),
  created_by uuid references auth.users on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invites_household_idx on public.invites(household_id);

alter table public.invites enable row level security;

-- Members can see their household's invites; admins create them.
create policy invites_member_select on public.invites
  for select using (public.is_household_member(household_id));
create policy invites_admin_insert on public.invites
  for insert with check (public.is_household_admin(household_id));
create policy invites_admin_delete on public.invites
  for delete using (public.is_household_admin(household_id));

-- Admin creates an invite; returns the token to embed in a tododo://join link.
create or replace function public.create_invite(p_household_id uuid, p_role text default 'member')
  returns public.invites
  language plpgsql security definer set search_path = public as $$
declare
  inv public.invites;
begin
  if not public.is_household_admin(p_household_id) then
    raise exception 'Only an admin can create invites';
  end if;
  insert into public.invites (household_id, role, created_by)
  values (p_household_id, coalesce(p_role, 'member'), auth.uid())
  returning * into inv;
  return inv;
end;
$$;

-- Redeem a token: joins the caller to the household. SECURITY DEFINER so a
-- non-member can insert their own membership row only through this validated path.
create or replace function public.accept_invite(p_token text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites
    where token = p_token and expires_at > now() and accepted_by is null
    limit 1;
  if inv.id is null then
    raise exception 'Invite is invalid or has expired';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, auth.uid(), inv.role)
  on conflict (household_id, user_id) do nothing;

  update public.invites set accepted_by = auth.uid() where id = inv.id;
  return inv.household_id;
end;
$$;
