# TimeTree video review and implementation — 12 September 2026

Source: `../../docs/ScreenRecording_09-12-2026 10-57-50_1.MP4` (152.55 s, 1180 × 2556). Context: `../../output/pdf/tododo-vestluse-kontekst-ja-jatkuprompt.pdf`, all six pages read. The audio is silent (peak and mean -91 dB); there are no spoken instructions to transcribe.

Reviewed the complete clip with five-second overview frames, two-second frames for calendar creation (7–57 s), three-second frames for the middle section (58–130 s), and one-second frames for the editor (125–152 s). Intermediate contact sheets are in `../../tmp/video-review/`; timestamps below are elapsed video time, not the phone clock. Images of third-party users from the recording were not imported into tododo.

## Observed flows

| Time | Directly visible behavior | Applied to tododo |
| --- | --- | --- |
| 00:00–00:07 | Compact calendar filters, month grid, lower-right add control. | Preserved the user's own topic filters and reserved space for the existing lower-right button. |
| 00:07–00:15 | Calendar list with landscape cover thumbnails; shared/public choice. | Quieter calendar list and wider photo thumbnails. Shared/public destinations are not presented as working features. |
| 00:15–00:25 | Calendar type list: Family, Personal, Relationship, Work, Friends, Shift schedule, Lesson, School events, Group, Hobbies. | Type selection before editing the name, cover photo, icon and color; nine useful presets plus Start from scratch. Presets prefill actual persisted fields. They do not assign sharing permissions. |
| 00:25–00:35 | Name dialog and calendar creation. | Editable name and a single Save action; retains the previously implemented photo flow in the same form. Successful creation selects the new calendar. |
| 00:35–00:45 | Family role selection, optional Skip, then Next. | Not reproduced: membership and permissions have no working backend in this project. These TimeTree family labels are also different from authorization roles. |
| 00:45–00:53 | Invite Members; share sheet with WhatsApp, Messenger, QR, mail and copy-link options. | Blocked by missing backend configuration and membership/invitation implementation. No fake invitation links or messages. |
| 00:53–01:16 | Calendar-specific activity, Album empty state, event change cards; empty Memo tab around 01:13. | Existing activity cards retained. Memos now have a real destination in the calendar's view selector; memo activity has its own label and no misleading event date. |
| 01:16–01:36 | Calendar list, More/settings, main calendar, filter settings. | Preserved direct calendar management and the user's compact multi-topic dropdown. |
| 01:37–02:08 | Premium marketing, plan selection, FAQ, precautions, restore-purchases menu. | Not copied: third-party prices, purchase claims and marketing are not tododo product decisions. |
| 02:10–02:14 | Add opens a submenu, then a near-full-height event form and keyboard. Title → calendar → all-day → start/end date and time → memo → label → participants. | Single-tap add opens a near-full-height form. Order follows the recording, with the unavailable participant control omitted. No image-scanning intermediary. |
| 02:15–02:17 | Calendar picker slides up with photos and radio selection. | In-editor bottom sheet with actual calendars, local covers, and selected state. |
| 02:18–02:20 | Ten-minute reminder; all-day hides time controls and shows a one-day reminder. | Timed events default to the next whole hour and one-hour duration; all-day toggles to one-day reminder if notifications are enabled. The exact next-hour algorithm is a tododo decision, inferred from the visible 11:00–12:00 defaults. |
| 02:21–02:23 | Save as memo hides dates and notifications. Returning to an event restores dates. | Persisted memo flag; memos are excluded from all date grids, shown under Memos, editable, completable, deletable, and convertible back to dated plans. |
| 02:24–02:26 | Bottom label sheet with colored bars and radio choices. | Topic sheet with colors, current choice, and existing create-topic action. |
| 02:18–02:29 | Optional chips: repeat, day counter, location, URL, note, to-do list, files. Their subforms are not opened. | Working optional Location, URL, Note and To-do list fields. Their detailed layouts are tododo implementations, not claimed as exact video copies. Repeat, day counter and attachments were not added as inert controls. |
| 02:30–02:32 | Closing prompts to discard entered information. | Dirty-draft confirmation, Keep editing and Discard; untouched drafts close directly. |

The clip does not save an event, edit a saved event, open a date/time picker, or change a calendar photo. Save/update/delete behavior, date picking, inclusive end dates, reminder options and error recovery are implementation choices tested in tododo, not claims about unseen TimeTree rules.

## Implementation and deliberate differences

- Keep tododo's indigo identity and light/dark themes, the non-scrolling main month, no bottom information blocks or old tagline, compact expandable topic filters with multi-selection and clear action, and the lower-right add button. The video filters calendars; tododo retains separate calendar selection and topic filters as requested.
- Event editor uses the installed React Native Modal and Picker, with an in-modal overlay for choices. This keeps one presentation surface and a draft that survives opening/closing pickers. A second native modal for each row would complicate keyboard and dismissal behavior. No dependencies or framework upgrades were added in this pass.
- Optional `endDate`, `isMemo`, `location`, `url`, and `checklist` fields persist in AsyncStorage. New fields round-trip through Supabase row mapping. `0008_todo_event_details.sql` adds the columns without changing ownership/RLS. This migration is prepared, not applied to a live backend.
- Date-range expansion is bounded to the displayed year plus neighboring spill days, so a long event cannot generate unbounded rows. Each covered day points to the same event, allowing edits and deletion from any day. Legacy events remain single-day events.
- Notification selections calculate actual offsets using the existing local scheduler. All-day reminders are based on 09:00, explicitly shown in the form. Notification delivery still requires an appropriate native build, permissions, and a future reminder time; automated tests verify calculation, not delivery on a real phone.
- Saving is guarded against repeated taps. Failed local writes preserve the editor. A failed event save cancels the newly scheduled notification and preserves the previous notification. Deletion cancels its notification after persistence succeeds.
- Calendar photos keep the existing permanent local-file storage, draft preview, replacement, removal and rollback behavior. The type templates use native emoji and local colors, not copied TimeTree artwork.

## Backend blocker

Both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in this workspace are empty/placeholders. `HouseholdContext` returns empty data and unimplemented membership methods. Existing personal todo tables are owner-scoped, separate from the unfinished household schema. Therefore family invitations, participant assignment, shared/public calendars, realtime member activity and cloud cover photos cannot be honestly demonstrated here. No backend deployment, account setup, invitation sending or publication was performed.

## Verification

- 42 Jest tests pass, covering the existing suite plus date ranges, legacy data, memo isolation, URL validation, notification offsets, the new editor flow, draft preservation during background updates, duplicate-save prevention, save failures, deletion confirmation, event-details persistence/cloud mapping, calendar templates and photo replacement failure.
- TypeScript and lint for all files changed in this pass pass. Lint uses the installed Expo flat preset through `/private/tmp/tododo-video-eslint.cjs`, matching the prior workflow; no package/config upgrade.
- iPhone 17 Pro / Expo Go: month fits, creation and changes work, a 12–14 September event appears on all three days and opens from its final day. Memo conversion removes it from the date grid and the memo is available under Memos. Discard confirmation preserves changes when continuing.
- Calendar creation: template and edited name retained. One photo selection failed; the editor showed an error and retained the draft. Selecting a second image succeeded and its preview saved with the calendar. The cover thumbnail and memo both survived an Expo reload. Removing the photo and saving restored the emoji cover. The test calendar and memo were deleted through their confirmation flows, leaving the original Personal calendar and All calendars selection. Normal deletion tombstones/activity history remain as designed.
- iPhone 16e / Expo Go: November 2026 (six weeks) fits with topic filters expanded; the add button does not overlap dates. The dark editor and an 86-character title were visually checked with the software keyboard visible; Save remained accessible and the title wrapped. The test draft was discarded and light theme restored. A component test also supplies five plans on the last row at a constrained 276-pixel grid height, verifying 42 reachable date buttons and the +5 overflow indicator.
- Not exercised: Android, physical devices, maximum accessibility text sizes, live notification delivery, live cloud migration/sync and shared multi-user use. Photo replacement failure is covered by automation; successful replacement was not repeated manually in this pass. The renderer was reloaded, not the entire simulator rebooted.

## Official references verified for the installed runtime

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) as required by AGENTS.md; the installed SDK remains 54.
- [React Native 0.81 Modal](https://reactnative.dev/docs/0.81/modal): presentation and dismissal behavior.
- [Expo SDK 54 Picker](https://docs.expo.dev/versions/v54.0.0/sdk/picker/): installed native wheel selection.
- [Expo SDK 54 Notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/): existing scheduled date-notification integration.
