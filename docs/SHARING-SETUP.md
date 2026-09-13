# Shared calendars: setup and validation

The app now implements creating shared calendars, listing real members, creating
one-use invitation links, previewing and accepting them, revoking pending links,
removing members, leaving calendars, and editing shared plans. Private calendars
continue to use `todo_*`; shared calendars use `households`, `calendars`, `events`.

## Connect a new Supabase project

1. Create a Supabase project for tododo in your own organization. Choose an EU
   region if that matches the intended users. Keep the database password private.
2. Apply the SQL files in `supabase/migrations` in numeric order, including
   `0008_todo_event_details.sql` and `0009_shared_calendar_invites.sql`.
   Migration `0005` requires the Supabase Cron (`pg_cron`) extension.
   With the Supabase CLI, link the intended project and use `supabase db push`.
   Inspect the target project before applying migrations.
3. In `.env`, fill only the public client values:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

   Never place a service-role key, secret API key or database password in
   `EXPO_PUBLIC_*` variables or the mobile app.
4. Enable email/password authentication. For OAuth/password-reset flows, allow
   `tododo://auth-callback` in Auth URL configuration. Email confirmation should
   remain enabled; after confirming, return to tododo and sign in with the same
   account. Production email delivery needs the project's SMTP setup.
5. Restart Metro (`npx expo start --clear`). Install a development or production
   build on both test phones to register the `tododo://` app scheme. Expo Go can
   test the pasted-link flow; it does not register this app's custom scheme.
6. Account A: Settings → People → create a shared calendar → Invite someone →
   Share invitation. The OS share sheet lets the user pick a recipient/channel.
7. Account B: open the link, or paste it into Settings → Join a calendar. Sign in,
   view the calendar name, then explicitly join. The link stays on the Join
   screen while the authentication modal is open.
8. Confirm both users see the calendar and can create/edit/complete a shared
   plan. Confirm a private plan stays visible only to its owner. Test a used,
   revoked and expired link and remove B's membership. B should lose access on
   refresh (Realtime, app foreground, or the 30-second reconciliation poll).

Invitation links are `tododo://join?token=…`, valid for 14 days, one recipient.
An installed app is required; a public web landing page/universal links are not
part of this change. The link itself is the invitation credential: share it
only with the intended recipient. The sender chooses when and where to send it.

## Scope and current limits

- Supabase is not connected in this workspace yet. No cloud migration, real
  email or invitation message has been sent. Two-device live verification is
  pending project connection.
- Shared calendar writes require a connection; failures retain an editor draft.
  Shared events are not cached into the private offline store.
- Existing private calendars are not automatically made public or moved to a
  group. Create a new shared calendar explicitly.
- Shared-plan reminders and remote push notifications are not implemented.
  The shared editor states this and does not pretend to schedule them.
- Shared calendar covers use built-in artwork. Uploaded photos remain local to
  private calendars; no photo upload/storage policy was added.
- Members can edit shared plans. Owners/admins invite; invitations grant member
  access only. The owner cannot leave or be removed. Ownership transfer and
  shared calendar deletion/renaming are not exposed in this version.

## Checks

`npm test -- --runInBand` includes pasted links, PostgREST composite results,
pagination beyond 500 rows, shared event details, reminder-data isolation and
sign-in → preview → explicit acceptance UI tests.

For actual SQL/RLS checks against a disposable local PostgreSQL cluster:

```sh
initdb -D /private/tmp/tododo-invite-pg -A trust --no-locale -E UTF8
pg_ctl -D /private/tmp/tododo-invite-pg -l /private/tmp/tododo-invite-pg.log -o '-k /private/tmp -p 55439 -h 127.0.0.1' start
python3 scripts/test-shared-db.py --port 55439
pg_ctl -D /private/tmp/tododo-invite-pg stop
```

The test creates and drops a uniquely named test database on localhost. It mocks
only `auth.uid()`, auth users and Supabase's default roles/grants; applies actual
migrations (excluding the unrelated local-unavailable `pg_cron` job); then tests
membership permissions, private-data isolation, token expiry/revocation and a
race between two independent SQL connections redeeming one token.

References checked 2026-09-12:
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgREST RPC response formats](https://docs.postgrest.org/en/stable/references/api/functions.html)
- [Expo 54 linking](https://docs.expo.dev/versions/v54.0.0/sdk/linking/)
- [React Native 0.81 Share](https://reactnative.dev/docs/0.81/share)
- [Expo 54 notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/)
