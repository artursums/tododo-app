# tododo UI refresh — 9 September 2026

## Product direction

A calm, warm calendar for the everyday mix of personal time, family plans, and tasks. Keep the existing indigo identity, soften the canvas to warm off-white, and reserve strong accent color for selection and primary actions. Category colors stay stable; existing user data and calendar colors are not migrated.

This is a React Native / Expo SDK 54 app, not a website. The repository asks agents to read the SDK 57 reference; both versioned references were consulted. No framework upgrade was needed. Calendar photos add the SDK-compatible `expo-image-picker` dependency.

## Evidence and application

- [Fantastical calendar sets](https://flexibits.com/fantastical/help/calendar-sets): a comparison point for switching calendar context directly. The refresh uses the existing single-calendar or all-calendars model; saved sets are outside this change.

- [TimeTree's 2026 calendar navigation update](https://timetreeapp.com/intl/en/newsroom/2026-01-21/introduction-restructure-02): calendar switching and distinct calendar colors. Applied as an in-place calendar picker, persistent calendar name, and colored calendar cards.
- [NN/g: recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/): expose choices rather than requiring users to remember hidden behavior. Applied as Month / Week / Year tabs, an explicit Today button, expandable compact topic filters, and visible edit buttons for calendars.
- [NN/g: visual design principles](https://www.nngroup.com/articles/principles-visual-design/): scale, hierarchy, proximity, and contrast help people scan. Applied as a quieter brand row, prominent period heading, grouped calendar controls, and time / title / category hierarchy in agenda cards.
- [NN/g: aesthetic-usability effect](https://www.nngroup.com/articles/aesthetic-usability-effect/): attractive interfaces can improve perceived ease and tolerance, but do not prove actual usability or sales. Applied as consistent spacing, rounded surfaces, restrained color, and a concrete product preview on onboarding.
- [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility): applied through explicit button labels, selected/checked states, larger primary touch targets, stronger secondary text contrast, safe-area-aware navigation, and a scrollable welcome screen. Full accessibility conformance has not been audited.
- [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) and [SDK 57](https://docs.expo.dev/versions/v57.0.0/): keep implementation aligned with the installed runtime.

## Interaction decisions

The main month view fills the available height without vertical scrolling. At the user’s request, there is no content below the month, the tagline has been removed, and adding a plan uses a floating plus button at the lower right, with space reserved inside the calendar card so it does not cover dates. Tapping a date opens its agenda in an in-screen sheet; the native event editor can present over that sheet. Longer week/year views and day agendas remain scrollable to keep all plans accessible. Month cells reduce event previews to the available space and retain an overflow count.

The compact month uses two event previews and an overflow count; the agenda supplies full titles. Soft category fills with readable foreground text replace tiny white text on bright fills. Topic filters retain multi-selection. The compact row shows three chips and a down arrow; expanding reveals every topic without horizontal scrolling, plus a clear-selection action when needed. An empty state explains when filters hide results.

Task completion and event editing use separate sibling controls to avoid nested button activation. Calendar management retains long press but exposes editing visually as well. No custom fonts, new illustration downloads, or extra navigation libraries were added.

## Scope boundary

Existing household/backend code is incomplete for end-to-end shared calendar collaboration. This change does not implement invitations, membership permissions, or realtime family updates. Onboarding no longer promises that every phone is already always in sync. Its sample plans are presentation-only; no demo events are inserted into storage.

## What to measure next

These changes are design hypotheses, not measured conversion improvements. Compare the previous and refreshed experiences using time to create a first plan, first-plan completion rate, successful calendar switching, and 7-day return rate. Once sharing works, measure invite acceptance and a second member creating a plan. Paid conversion needs a separate experiment after a real pricing/paywall flow exists; avoid claiming that a color or layout alone increases revenue.

## Validation

- TypeScript type check passed.
- 27 Jest tests passed: the full 24-test suite followed by the 3 new photo-storage tests. Coverage includes expanding and clearing topics, completing without opening the editor, recovering from an empty filtered day, retaining device-local photos during metadata sync, and safe persistent photo copying.
- Changed TypeScript files passed ESLint using the installed Expo flat preset. The repository has no checked-in ESLint config, so the check used a temporary config outside the repository.
- Expo Go / iPhone 17 Pro simulator: inspected calendar, week, calendar picker, calendar management/editor, event editor, and dark onboarding. Created a local test plan, completed it, filtered it, reset filters, and deleted that test plan. Verified the completed checkbox after returning to the week and verified calendar editing is independently exposed in the accessibility tree. Restored the original light theme.
- Onboarding was visually inspected with a temporary entry-point override that was restored afterward; no preview override remains in the app.
- Follow-up simulator checks verified compact topic expansion without horizontal scrolling, selecting and saving a calendar photo, retaining its thumbnail after reloading the app, and removing it. One sample gallery image failed to load; the editor retained the draft and another image saved successfully.
- Android, physical devices, larger accessibility text sizes, six-week populated months, and real multi-user synchronization were not exercised. No claims of full accessibility conformance or measured commercial uplift.

## Calendar photos and TimeTree event comparison

The calendar editor supports selecting, previewing, replacing, and removing a photo using the system photo picker (`expo-image-picker`, installed for SDK 54). Selecting a photo does not write calendar data until Save. Saving copies the picker cache file into private document storage; only a relative filename is persisted. A failed copy or calendar write keeps the draft open and shows an error. Removed/replaced covers are cleaned up after a successful save. Calendar rows, the active-calendar chip, and the calendar picker show the chosen photo with an emoji fallback.

Photos are device-local in the current offline setup. They are not uploaded to a cloud service and will not appear on a family member's device or survive uninstalling the app. Calendar sync preserves the current device's cover while accepting newer remote metadata and never sends a local path to Supabase. Shared photo storage requires the future shared-calendar backend.

Sources checked 9 September 2026:

- [TimeTree calendar settings](https://support.timetreeapp.com/hc/en-us/articles/203724665-Change-calendar-settings): separate cover image, calendar name, and header color settings.
- [TimeTree event creation](https://support.timetreeapp.com/hc/en-us/articles/204934675-How-to-create-events-notification-repeat-attachment-checklist-day-count): + opens a form starting with title and time/all-day, followed by calendar, color label, participants, and notifications. Additional details include repeat, location, URL, notes and checklist; file attachment is described as Premium. Save is at the top right.
- [TimeTree quick events](https://support.timetreeapp.com/hc/en-us/articles/38118007932185-How-to-add-events-quickly): long-pressing a date in a shared calendar offers history-based creation; this is distinct from its home calendar.
- [Expo ImagePicker SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/): the modern system library picker does not require broad photo-library permission for image selection.
- [Expo FileSystem SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/): private document storage and File.copy keep a photo outside the temporary picker cache.

The existing event form now follows title → date/all-day/time → calendar/topic → reminder/notes. Recurrence, participant assignment, time zones, locations and event attachments were researched but not implemented in this change. Their data and synchronization requirements need separate implementation.


## Video-based follow-up — 12 September 2026

The actual recording has now been reviewed. [Video analysis and implementation notes](VIDEO-REVIEW-2026-09-12.md) supersede the earlier assumed editor order: the video places the calendar immediately after the title. The follow-up implements calendar type presets, the near-full-height event editor, bottom choice sheets, date ranges, memos, reminder offsets and optional event details. It retains the existing photo handling and required compact main view. See that document for timestamped evidence, runtime checks and the missing shared-backend configuration.

## Home header refinement — 2026-09-12

Removed the tododo wordmark from Calendar. The period is now the primary heading,
with a quiet calendar selector below it. Previous / Today / Next form one group
on the right; Month / Week / Year / Memos use the full row below. Removed the old
brand styles and added the missing custom upward chevron for expanded filters.
Checked on iPhone 17 Pro: month, week crossing a month boundary, memos and opening
the calendar picker. TypeScript, ESLint and whitespace checks passed.
