#!/usr/bin/env python3
"""Exercise actual migrations/RLS in an isolated, disposable LOCAL PostgreSQL DB.
Start a local cluster first, then: python3 scripts/test-shared-db.py --port 55439
No Supabase credentials are used; only auth.uid() and platform grants are mocked.
"""
import argparse
import concurrent.futures
from pathlib import Path
import subprocess
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, required=True)
args = parser.parse_args()
db = 'tododo_test_' + uuid.uuid4().hex[:12]
base = ['psql', '-X', '-h', '127.0.0.1', '-p', str(args.port), '-v', 'ON_ERROR_STOP=1', '-At']
checks = 0

def sql(statement, user=None, fails=None, database=db):
    global checks
    prefix = f"set role authenticated; set request.jwt.claim.sub = '{user}';" if user else ''
    result = subprocess.run(base + ['-d', database, '-c', prefix + statement], capture_output=True, text=True)
    if fails:
        assert result.returncode != 0 and fails.lower() in result.stderr.lower(), result.stdout + result.stderr
        checks += 1
    else:
        assert result.returncode == 0, result.stderr
    return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''

def equal(statement, expected, user=None):
    global checks
    actual = sql(statement, user)
    assert actual == str(expected), f'{statement}: expected {expected}, got {actual}'
    checks += 1

owner, member, stranger, outsider = ['00000000-0000-0000-0000-' + str(i).zfill(12) for i in range(1, 5)]
sql(f'create database {db}', database='postgres')
try:
    # Roles are cluster-global, so tolerate subsequent runs against this cluster.
    sql("do $$ begin create role anon nologin; exception when duplicate_object then null; end $$; do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;")
    sql("create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; alter default privileges in schema public grant all on tables to anon, authenticated; create publication supabase_realtime;")
    for migration in sorted((Path(__file__).resolve().parents[1] / 'supabase/migrations').glob('*.sql')):
        if migration.name.startswith('0005_'):
            continue  # pg_cron is a Supabase extension, unrelated to membership RLS.
        sql(migration.read_text())
    sql('insert into auth.users(id,email) values ' + ','.join(f"('{u}','person{i}@example.test')" for i,u in enumerate([owner,member,stranger,outsider])))
    hid = sql("select id from public.create_household('Our family')", owner)
    cal = sql(f"select id from public.calendars where household_id='{hid}'", owner)
    equal(f"select role from public.household_members where household_id='{hid}'", 'owner', owner)
    equal(f"select count(*) from public.calendars where household_id='{hid}'", 0, stranger)
    sql('truncate public.household_members cascade', member, fails='permission denied')
    sql('set role anon; truncate public.events', fails='permission denied')
    sql("select public.create_household('')", owner, fails='1–48')
    sql("set role anon; select public.create_household('No account')", fails='permission denied')
    sql(f"select public.create_invite('{hid}')", stranger, fails='Only an owner')
    sql(f"select public.create_invite('{hid}','admin')", owner, fails='member access only')
    token = sql(f"select token from public.create_invite('{hid}')", owner)
    equal(f"select length(token) from public.invites where token='{token}'", 48, owner)
    equal(f"select household_name from public.preview_invite('{token}')", 'Our family', member)
    equal(f"select public.accept_invite('{token}')", hid, owner)
    equal(f"select accepted_by is null from public.invites where token='{token}'", 't', owner)
    equal(f"select public.accept_invite('{token}')", hid, member)
    equal(f"select public.accept_invite('{token}')", hid, member)
    equal(f"select role from public.household_members where user_id='{member}'", 'member', member)
    sql(f"select public.accept_invite('{token}')", stranger, fails='expired, was used, or was revoked')
    sql(f"update public.household_members set role='owner' where user_id='{member}'", member, fails='permission denied')
    sql(f"delete from public.household_members where user_id='{owner}'", member, fails='permission denied')
    sql(f"select public.remove_household_member('{hid}','{owner}')", owner, fails='owner must stay')
    equal('select count(*) from public.invites', 0, member)
    sql(f"select public.create_invite('{hid}')", member, fails='Only an owner')
    sql(f"insert into public.events(household_id,calendar_id,id,title,date,is_memo,checklist) values('{hid}','{cal}','plan','Family trip','2026-09-12',false,'[{{\"id\":\"pack\",\"title\":\"Pack\",\"completed\":false}}]')", owner)
    equal("select title from public.events where id='plan'", 'Family trip', member)
    sql("update public.events set title='Family trip updated', end_date='2026-09-14' where id='plan'", member)
    equal("select title from public.events where id='plan'", 'Family trip updated', owner)
    equal('select count(*) from public.events', 0, stranger)
    sql(f"insert into public.events(household_id,id,title,date) values('{hid}','bad','Intrusion','2026-09-12')", stranger, fails='row-level security')
    sql(f"insert into public.todo_items(user_id,id,title,date) values('{owner}','private','Private plan','2026-09-12')", owner)
    equal('select count(*) from public.todo_items', 0, member)
    other_hid = sql("select id from public.create_household('Another group')", outsider)
    other_cal = sql(f"select id from public.calendars where household_id='{other_hid}'", outsider)
    sql(f"insert into public.events(household_id,calendar_id,id,title,date) values('{hid}','{other_cal}','bad-cal','Wrong group','2026-09-12')", member, fails='foreign key')
    revocable = sql(f"select token from public.create_invite('{hid}')", owner)
    inv_id = sql(f"select id from public.invites where token='{revocable}'", owner)
    sql(f"select public.revoke_invite('{inv_id}')", member, fails='Only an owner')
    sql(f"select public.revoke_invite('{inv_id}')", owner)
    sql(f"select public.accept_invite('{revocable}')", stranger, fails='expired, was used, or was revoked')
    expired = sql(f"select token from public.create_invite('{hid}')", owner)
    sql(f"update public.invites set expires_at=now()-interval '1 minute' where token='{expired}'")
    sql(f"select public.accept_invite('{expired}')", stranger, fails='expired, was used, or was revoked')
    sql(f"select public.remove_household_member('{hid}','{member}')", owner)
    equal('select count(*) from public.events', 0, member)
    sql(f"select public.accept_invite('{token}')", member, fails='expired, was used, or was revoked')
    race_token = sql(f"select token from public.create_invite('{hid}')", owner)
    def redeem(user):
        return subprocess.run(base + ['-d', db, '-c', f"begin; set role authenticated; set local request.jwt.claim.sub='{user}'; select public.accept_invite('{race_token}'); select pg_sleep(0.2); commit;"], capture_output=True, text=True).returncode
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(redeem, [member, stranger]))
    assert sorted(outcomes) == [0, 1], outcomes
    checks += 1
    equal(f"select count(*) from public.household_members where household_id='{hid}'", 2, owner)
    print(f'PASS: {checks} database assertions, including concurrent redemption, private-data isolation and revoked access.')
finally:
    sql(f'drop database {db} with (force)', database='postgres')
