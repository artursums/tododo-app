import { Platform } from 'react-native'
import { TodoItem, TodoCategory, FALLBACK_CATEGORY_COLOR } from '../types/todo'

// Shared App Group + widget kind. Must match the (future, M4) widget target's
// `appGroupIdentifier` and its WidgetKit `kind`.
const APP_GROUP = 'group.com.effectly.tododo'
const WIDGET_KIND = 'TododoCalendarWidget'
const CALENDAR_KEY = 'calendarEvents'

// Cap the payload so the App Group blob stays small — the widget only shows the
// current week/month, so a few hundred events is far more than it can render.
const MAX_EVENTS = 300

/**
 * Pushes the user's to-do items into the shared App Group so the iOS home-screen
 * calendar widget can render them, then asks WidgetKit to reload it.
 *
 * The widget target itself lands in M4; until then this is a harmless no-op:
 * `@bacons/apple-targets` is lazy-required (its native module is absent in Expo
 * Go, and importing it eagerly would crash there) and every failure is
 * swallowed. Category colors are resolved here (in JS) into a hex string,
 * because the widget only receives events. No-op on Android.
 */
export function syncCalendarToWidget(items: TodoItem[], categories: TodoCategory[]): void {
  if (Platform.OS !== 'ios') return
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExtensionStorage } = require('@bacons/apple-targets')

    const colorOf = (id: string) =>
      categories.find(c => c.id === id)?.color ?? FALLBACK_CATEGORY_COLOR

    const events = items
      .filter(i => !i.deletedAt)
      .slice(0, MAX_EVENTS)
      // Values are kept string|number (booleans → 0/1, null → '') so they satisfy
      // ExtensionStorage's typed API; Swift reads the flags back as Int.
      .map(i => ({
        id: i.id,
        date: i.date, // 'yyyy-MM-dd'
        title: i.title,
        color: colorOf(i.categoryId),
        allDay: i.allDay ? 1 : 0,
        startTime: i.startTime ?? '',
        completed: i.completed ? 1 : 0,
      }))

    const storage = new ExtensionStorage(APP_GROUP)
    storage.set(CALENDAR_KEY, events)
    // -> WidgetCenter.reloadTimelines(ofKind: WIDGET_KIND)
    ExtensionStorage.reloadWidget(WIDGET_KIND)
  } catch {
    // Widget target not built yet / Expo Go — nothing to sync to.
  }
}
