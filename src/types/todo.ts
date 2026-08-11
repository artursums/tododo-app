/**
 * To-Do Calendar data model (ported from the breathing app's BA-015 feature —
 * the calendar was spun out of that app into tododo).
 *
 * Design notes:
 * - `date` is a local-calendar day key ('YYYY-MM-DD'), never a UTC instant.
 * - IDs are client-generated UUID-ish strings so an item created offline keeps
 *   the same identity after it syncs to Supabase (no server-id reconciliation).
 * - `updatedAt` drives last-write-wins sync; `deletedAt` is a soft-delete
 *   tombstone so deletes propagate across devices/reinstalls.
 */

export interface TodoCategory {
  id: string
  name: string
  /** Fixed hex (drawn from the app tint palette); used with alpha for chips/bars. */
  color: string
  order: number
  updatedAt: string
  deletedAt?: string
}

/**
 * A calendar (TimeTree-style): every item belongs to exactly one. 'Personal' is
 * seeded on first run; users can add more (Work, Family, …). A shared calendar
 * is one whose backing household has other members — the sharing layer arrives
 * with the Supabase wiring (M1/M2); the local model is already shaped for it.
 */
export interface TodoCalendar {
  id: string
  name: string
  /** Cover tile tint (hex from the app palette). */
  color: string
  /** Cover tile glyph. */
  emoji: string
  order: number
  updatedAt: string
  deletedAt?: string
}

/** The seeded private calendar every install starts with. */
export const PERSONAL_CALENDAR_ID = 'cal-personal'
/** Pseudo-id for the merged "every calendar at once" view (never persisted on items). */
export const ALL_CALENDARS_ID = 'all'

export const DEFAULT_TODO_CALENDAR: Omit<TodoCalendar, 'updatedAt'> = {
  id: PERSONAL_CALENDAR_ID,
  name: 'Personal',
  color: '#6366F1', // indigo — the app accent
  emoji: '🗓️',
  order: 0,
}

/** Quick-pick cover glyphs for the calendar editor. */
export const CALENDAR_EMOJIS = ['🗓️', '🏠', '💼', '❤️', '👨‍👩‍👧', '🎉', '✈️', '🏃'] as const

/** Build a new user-created calendar (client id, appended to the end). */
export function makeCalendar(
  name: string,
  color: string,
  emoji: string,
  existing: TodoCalendar[],
): TodoCalendar {
  return {
    id: makeId(),
    name: name.trim(),
    color,
    emoji,
    order: existing.length,
    updatedAt: new Date().toISOString(),
  }
}

export interface TodoItem {
  id: string
  title: string
  /** Optional free-text body shown in the editor. */
  notes?: string
  categoryId: string
  /** Owning calendar. Absent on items from before multi-calendar → Personal. */
  calendarId?: string

  /** Local calendar day, 'YYYY-MM-DD'. */
  date: string
  allDay: boolean
  /** 'HH:mm' when !allDay. */
  startTime?: string
  endTime?: string

  completed: boolean
  completedAt?: string

  /** ISO timestamp; when set a local notification is scheduled. */
  reminderAt?: string
  /** expo-notifications identifier, for cancel/reschedule. */
  reminderNotificationId?: string

  createdAt: string
  updatedAt: string
  /** Soft-delete tombstone (ISO). Tombstoned rows are filtered out of the UI. */
  deletedAt?: string
}

/**
 * Default categories seeded on first run so the calendar isn't colorless.
 * Colors come from tododo's tint palette (theme.ts MEMBER_COLORS family) and
 * read well in light+dark.
 */
export const DEFAULT_TODO_CATEGORIES: Omit<TodoCategory, 'updatedAt'>[] = [
  { id: 'cat-personal', name: 'Personal', color: '#6366F1', order: 0 }, // indigo
  { id: 'cat-work', name: 'Work', color: '#0EA5E9', order: 1 }, // sky
  { id: 'cat-health', name: 'Health', color: '#10B981', order: 2 }, // emerald
  { id: 'cat-errands', name: 'Errands', color: '#F59E0B', order: 3 }, // amber
  { id: 'cat-social', name: 'Social', color: '#FB7185', order: 4 }, // coral
]

export const FALLBACK_CATEGORY_COLOR = '#6B7280'

/**
 * Palette used to auto-color user-created tags. Same tint family as the seeded
 * defaults so a hand-made tag sits visually next to them, and every color reads
 * well on both light and dark backgrounds.
 */
export const CATEGORY_COLOR_PALETTE = [
  '#6366F1', // indigo
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#FB7185', // coral
  '#A855F7', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#EF4444', // red
  '#84CC16', // lime
  '#F97316', // orange
  '#8B5CF6', // violet
  '#3B82F6', // blue
  '#06B6D4', // cyan
  '#22C55E', // green
] as const

/** Lightweight unique id (timestamp + random suffix). UUID-shaped enough for our use. */
export const makeId = (): string =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`

/**
 * Pick a palette color for a new tag, preferring one not already in use so
 * distinct tags stay visually distinct. Falls back to the full palette once
 * every color is taken.
 */
export function pickCategoryColor(existing: TodoCategory[]): string {
  const used = new Set(existing.map(c => c.color.toLowerCase()))
  const free = CATEGORY_COLOR_PALETTE.filter(c => !used.has(c.toLowerCase()))
  const pool = free.length > 0 ? free : [...CATEGORY_COLOR_PALETTE]
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Build a new user-created tag (client id, auto color, appended to the end). */
export function makeCategory(name: string, existing: TodoCategory[]): TodoCategory {
  return {
    id: makeId(),
    name: name.trim(),
    color: pickCategoryColor(existing),
    order: existing.length,
    updatedAt: new Date().toISOString(),
  }
}
