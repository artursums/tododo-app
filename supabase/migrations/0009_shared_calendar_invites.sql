-- Shared calendars use their own tables. Private todo_* rows remain owner-only.
alter table public.calendars add column if not exists emoji text not null default '🏠';
alter table public.events add column if not exists created_at timestamptz not null default now();
alter table public.events add column if not exists end_date date;
alter table public.events add column if not exists is_memo boolean not null default false;
alter table public.events add column if not exists location text;
alter table public.events add column if not exists url text;
alter table public.events add column if not exists checklist jsonb not null default '[]';
alter table public.events add column if not exists topic_name text;
alter table public.invites add column if not exists revoked_at timestamptz;
alter table public.invites alter column token set default encode(gen_random_bytes(24), 'hex');

-- A member must not attach an event to a calendar in another household.
create unique index if not exists calendars_household_id_unique on public.calendars(household_id, id);
alter table public.events add constraint events_calendar_household_fk
  foreign key (household_id, calendar_id) references public.calendars(household_id, id);
alter table public.events add constraint events_checklist_array check (jsonb_typeof(checklist) = 'array');

-- RLS does not cover TRUNCATE. Strip non-DML privileges even on installations
-- whose default grants are ALL; unauthenticated callers need no table access.
revoke all on public.households, public.household_members, public.invites, public.calendars, public.events, public.event_categories, public.profiles, public.todo_items, public.todo_categories, public.todo_calendars from anon, public;
revoke truncate, references, trigger on public.households, public.household_members, public.invites, public.calendars, public.events, public.event_categories, public.profiles, public.todo_items, public.todo_categories, public.todo_calendars from authenticated;
-- Shared calendar creation is atomic with membership in create_household.
revoke insert, update, delete on public.calendars from authenticated;
grant select on public.calendars to authenticated;

-- Membership changes only through authenticated, checked RPCs. In particular an
-- admin cannot promote themselves to owner or remove the last owner.
revoke insert, update, delete on public.household_members from public, anon, authenticated;
revoke insert, update, delete on public.invites from public, anon, authenticated;
revoke insert, update, delete on public.households from public, anon, authenticated;
grant select on public.households, public.household_members, public.invites to authenticated;
drop policy invites_member_select on public.invites;
create policy invites_admin_select on public.invites for select to authenticated
  using (public.is_household_admin(household_id));

create or replace function public.create_household(p_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Sign in to create a shared calendar'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 48 then raise exception 'Use a name with 1–48 characters'; end if;
  insert into public.households(name, created_by) values(trim(p_name), auth.uid()) returning * into h;
  insert into public.household_members(household_id, user_id, role) values(h.id, auth.uid(), 'owner');
  insert into public.calendars(household_id, name) values(h.id, h.name);
  return h;
end;
$$;

create or replace function public.create_invite(p_household_id uuid, p_role text default 'member') returns public.invites
language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null or not public.is_household_admin(p_household_id) then raise exception 'Only an owner or admin can invite people'; end if;
  if p_role is distinct from 'member' then raise exception 'Invitations grant member access only'; end if;
  insert into public.invites(household_id, role, created_by) values(p_household_id, 'member', auth.uid()) returning * into inv;
  return inv;
end;
$$;

create or replace function public.preview_invite(p_token text)
returns table(household_name text, expires_at timestamptz, already_member boolean)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view this invitation'; end if;
  return query select h.name, i.expires_at, public.is_household_member(h.id)
    from public.invites i join public.households h on h.id = i.household_id
    where i.token = p_token and i.revoked_at is null and i.expires_at > now()
      and (i.accepted_by is null or i.accepted_by = auth.uid());
  if not found then raise exception 'This invitation has expired, was used, or was revoked'; end if;
end;
$$;

create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'Sign in to join a calendar'; end if;
  -- Lock before checking/consuming so only one recipient can redeem the link.
  select * into inv from public.invites where token = p_token for update;
  if inv.id is null or inv.revoked_at is not null or inv.expires_at <= now()
     or (inv.accepted_by is not null and inv.accepted_by <> auth.uid()) then
    raise exception 'This invitation has expired, was used, or was revoked';
  end if;
  -- Do not consume a pending invitation when an existing member opens it.
  if public.is_household_member(inv.household_id) then return inv.household_id; end if;
  insert into public.household_members(household_id, user_id, role) values(inv.household_id, auth.uid(), 'member');
  update public.invites set accepted_by = auth.uid() where id = inv.id;
  return inv.household_id;
end;
$$;

create or replace function public.revoke_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  select * into inv from public.invites where id = p_invite_id for update;
  if inv.id is null or auth.uid() is null or not public.is_household_admin(inv.household_id) then raise exception 'Only an owner or admin can revoke invitations'; end if;
  update public.invites set revoked_at = now() where id = inv.id;
end;
$$;

create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select role into target_role from public.household_members where household_id = p_household_id and user_id = p_user_id for update;
  if target_role is null then raise exception 'Member not found'; end if;
  if target_role = 'owner' then raise exception 'The owner must stay in this calendar'; end if;
  if p_user_id <> auth.uid() and not (public.is_household_owner(p_household_id) or (public.is_household_admin(p_household_id) and target_role = 'member')) then
    raise exception 'You do not have permission to remove this person';
  end if;
  delete from public.household_members where household_id = p_household_id and user_id = p_user_id;
  -- Previously accepted links must not restore access after removal.
  update public.invites set revoked_at = now() where household_id = p_household_id and accepted_by = p_user_id;
end;
$$;

revoke all on function public.create_household(text), public.create_invite(uuid,text), public.preview_invite(text), public.accept_invite(text), public.revoke_invite(uuid), public.remove_household_member(uuid,uuid) from public, anon;
grant execute on function public.create_household(text), public.create_invite(uuid,text), public.preview_invite(text), public.accept_invite(text), public.revoke_invite(uuid), public.remove_household_member(uuid,uuid) to authenticated;
