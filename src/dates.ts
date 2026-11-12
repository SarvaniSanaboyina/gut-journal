export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function shiftDate(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatWeekday(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short' })
}

export function formatDayNumber(iso: string): string {
  return String(parseISODate(iso).getDate())
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(h, m, 0, 0)
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function isToday(iso: string): boolean {
  return iso === todayISO()
}

export function mondayOf(iso: string): string {
  const weekday = parseISODate(iso).getDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  return shiftDate(iso, delta)
}

export function dateRange(startISO: string, endISO: string): string[] {
  if (endISO < startISO) return []
  const days: string[] = []
  for (let iso = startISO; iso <= endISO; iso = shiftDate(iso, 1)) {
    days.push(iso)
  }
  return days
}

export function calendarWeek(iso: string): string[] {
  const start = mondayOf(iso)
  return dateRange(start, shiftDate(start, 6))
}

/** Monday of the week containing `iso`, through Sunday or today — whichever is earlier. */
export function weekDates(iso: string, capISO = todayISO()): string[] {
  const start = mondayOf(iso)
  const sunday = shiftDate(start, 6)
  const end = sunday < capISO ? sunday : capISO
  return dateRange(start, end)
}

export function previousWeekDates(days: string[]): string[] {
  return days.map((iso) => shiftDate(iso, -7))
}

export function formatWeekRange(days: string[]): string {
  if (days.length === 0) return ''
  if (days.length === 1) return formatLongDate(days[0])
  const start = parseISODate(days[0]).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const end = parseISODate(days[days.length - 1]).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  return `${start} – ${end}`
}

export function weekdayLabels(): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    new Date(2026, 1, index + 1).toLocaleDateString(undefined, { weekday: 'short' }),
  )
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function monthCells(year: number, month: number): (string | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toISODate(new Date(year, month, day)))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function defaultMealType(time = nowTime()): import('./types').MealType {
  const hour = Number(time.slice(0, 2))
  if (hour >= 5 && hour < 9) return 'breakfast'
  if (hour >= 9 && hour < 11) return 'morning-snack'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 15 && hour < 17) return 'evening-snack'
  if (hour >= 17 && hour < 21) return 'dinner'
  return 'mini-snack'
}
