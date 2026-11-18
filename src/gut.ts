import { eatenFoods } from './foods'
import { parseISODate } from './dates'
import type { BristolType, JournalData, MealEntry, PoopEntry, Severity, SymptomEntry, SymptomType } from './types'

export const BRISTOL_TYPES: { type: BristolType; label: string; hint: string; group: BristolGroup }[] = [
  { type: 1, label: 'Type 1', hint: 'Separate hard lumps', group: 'hard' },
  { type: 2, label: 'Type 2', hint: 'Lumpy, sausage-shaped', group: 'hard' },
  { type: 3, label: 'Type 3', hint: 'Sausage with cracks', group: 'formed' },
  { type: 4, label: 'Type 4', hint: 'Smooth and soft', group: 'formed' },
  { type: 5, label: 'Type 5', hint: 'Soft blobs, clear edges', group: 'soft' },
  { type: 6, label: 'Type 6', hint: 'Mushy, fluffy pieces', group: 'loose' },
  { type: 7, label: 'Type 7', hint: 'Watery, no solid pieces', group: 'loose' },
]

export type BristolGroup = 'hard' | 'formed' | 'soft' | 'loose'

export const BRISTOL_GROUPS: { id: BristolGroup; label: string; range: string; color: string }[] = [
  { id: 'hard', label: 'Hard stools', range: 'Types 1–2', color: '#eb6834' },
  { id: 'formed', label: 'Formed stools', range: 'Types 3–4', color: '#1baf7a' },
  { id: 'soft', label: 'Soft pieces', range: 'Type 5', color: '#eda100' },
  { id: 'loose', label: 'Loose or watery', range: 'Types 6–7', color: '#2a78d6' },
]

export function bristolMeta(type: BristolType) {
  return BRISTOL_TYPES.find((item) => item.type === type) ?? BRISTOL_TYPES[3]
}

export function bristolGroup(type: number): BristolGroup {
  if (type <= 2) return 'hard'
  if (type <= 4) return 'formed'
  if (type === 5) return 'soft'
  return 'loose'
}

export function bristolGroupMeta(group: BristolGroup) {
  return BRISTOL_GROUPS.find((item) => item.id === group)!
}

export const SYMPTOMS: { id: SymptomType; label: string; icon: string }[] = [
  { id: 'bloating', label: 'Bloating', icon: '🎈' },
  { id: 'gas', label: 'Gas', icon: '💨' },
  { id: 'stomach-pain', label: 'Stomach pain', icon: '😣' },
  { id: 'constipation', label: 'Constipation', icon: '🧱' },
  { id: 'loose-stools', label: 'Loose stools', icon: '💧' },
  { id: 'diarrhoea', label: 'Diarrhoea', icon: '🌊' },
  { id: 'vomiting', label: 'Vomiting', icon: '🤮' },
  { id: 'acid-reflux', label: 'Acid reflux', icon: '🔥' },
  { id: 'other', label: 'Other', icon: '✏️' },
]

export const SEVERITIES: { id: Severity; label: string }[] = [
  { id: 'mild', label: 'Mild' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'severe', label: 'Severe' },
]

export const DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: '< 30 min' },
  { minutes: 45, label: '30–60 min' },
  { minutes: 120, label: '1–3 h' },
  { minutes: 300, label: '3–6 h' },
  { minutes: 600, label: '6 h +' },
  { minutes: 1440, label: 'All day' },
]

export function symptomLabel(symptom: Pick<SymptomEntry, 'type' | 'otherLabel'>) {
  if (symptom.type === 'other' && symptom.otherLabel) return symptom.otherLabel
  return SYMPTOMS.find((item) => item.id === symptom.type)?.label ?? symptom.type
}

export function symptomIcon(type: SymptomType) {
  return SYMPTOMS.find((item) => item.id === type)?.icon ?? '•'
}

export function formatDurationMinutes(minutes: number | null) {
  if (minutes == null) return ''
  const preset = DURATIONS.find((item) => item.minutes === minutes)
  if (preset) return preset.label
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** Local wall-clock timestamp in ms for comparing entries. */
export function stamp(date: string, time: string) {
  const day = parseISODate(date)
  const [h, m] = time.split(':').map(Number)
  day.setHours(h || 0, m || 0, 0, 0)
  return day.getTime()
}

export function formatGap(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours * 10) / 10} h`.replace('.0 h', ' h')
  const days = Math.round((hours / 24) * 10) / 10
  return `${days} day${days === 1 ? '' : 's'}`
}

/** Meals eaten in the hours before a symptom, newest first. */
export function mealsBefore(meals: MealEntry[], symptom: Pick<SymptomEntry, 'date' | 'time'>, windowHours = 24) {
  const onset = stamp(symptom.date, symptom.time)
  return meals
    .map((meal) => ({ meal, gap: (onset - stamp(meal.date, meal.time)) / 60000 }))
    .filter((item) => item.gap >= 0 && item.gap <= windowHours * 60)
    .sort((a, b) => a.gap - b.gap)
}

export type Association = {
  key: string
  foodName: string
  symptomType: SymptomType
  symptomName: string
  occasions: number
  exposures: number
  medianGapMinutes: number
  parentMarked: number
}

/**
 * Foods recorded within `windowHours` before each symptom. These are temporal
 * associations only: a food eaten at most meals will appear before most symptoms.
 */
export function findAssociations(data: JournalData, days: Set<string>, windowHours: number, minOccasions = 2): Association[] {
  const meals = data.meals.filter((meal) => days.has(meal.date))
  const exposures = new Map<string, number>()
  for (const meal of meals) {
    const keys = new Set(eatenFoods(meal).map((food) => food.key))
    for (const key of keys) exposures.set(key, (exposures.get(key) ?? 0) + 1)
  }
  const groups = new Map<string, { foodName: string; symptom: SymptomEntry; gaps: number[]; marked: number }>()
  for (const symptom of data.symptoms.filter((item) => days.has(item.date))) {
    const seen = new Map<string, { name: string; gap: number }>()
    for (const { meal, gap } of mealsBefore(data.meals, symptom, windowHours)) {
      for (const food of eatenFoods(meal)) {
        if (!seen.has(food.key)) seen.set(food.key, { name: food.name, gap })
      }
    }
    for (const [key, { name, gap }] of seen) {
      const groupKey = `${key}|${symptom.type}|${symptom.type === 'other' ? symptom.otherLabel : ''}`
      const group = groups.get(groupKey) ?? { foodName: name, symptom, gaps: [], marked: 0 }
      group.gaps.push(gap)
      if (symptom.reactions.some((reaction) => (reaction.foodId ?? `name:${reaction.foodName.toLowerCase()}`) === key)) group.marked += 1
      groups.set(groupKey, group)
    }
  }
  return [...groups.entries()]
    .filter(([, group]) => group.gaps.length >= minOccasions)
    .map(([groupKey, group]) => {
      const key = groupKey.split('|')[0]
      const gaps = [...group.gaps].sort((a, b) => a - b)
      return {
        key,
        foodName: group.foodName,
        symptomType: group.symptom.type,
        symptomName: symptomLabel(group.symptom),
        occasions: gaps.length,
        exposures: Math.max(exposures.get(key) ?? 0, gaps.length),
        medianGapMinutes: gaps[Math.floor(gaps.length / 2)],
        parentMarked: group.marked,
      }
    })
    .sort((a, b) => b.parentMarked - a.parentMarked || b.occasions / b.exposures - a.occasions / a.exposures || b.occasions - a.occasions)
}

export function associationSentence(item: Association, windowHours: number) {
  const occasions = item.occasions === 2 ? 'two occasions' : item.occasions === 3 ? 'three occasions' : `${item.occasions} occasions`
  const exposure = item.exposures > item.occasions
    ? ` ${item.foodName} was recorded at ${item.exposures} meals in this period, so some of these may be coincidence.`
    : ''
  return `${item.symptomName} was reported on ${occasions} within ${windowHours} hours after meals containing ${item.foodName.toLowerCase()} (typically about ${formatGap(item.medianGapMinutes)} later).${exposure}`
}

/** Earlier symptoms of the same kind where the same food was marked as suspected. */
export function previousSimilar(data: JournalData, symptom: Pick<SymptomEntry, 'id' | 'date' | 'time' | 'type'>, foodKey: string) {
  const at = stamp(symptom.date, symptom.time)
  return data.symptoms.filter(
    (other) =>
      other.id !== symptom.id &&
      other.type === symptom.type &&
      stamp(other.date, other.time) < at &&
      other.reactions.some((reaction) => (reaction.foodId ?? `name:${reaction.foodName.toLowerCase()}`) === foodKey),
  ).length
}

export function poopsByDay(poops: PoopEntry[]) {
  const map = new Map<string, PoopEntry[]>()
  for (const poop of poops) map.set(poop.date, [...(map.get(poop.date) ?? []), poop])
  return map
}

export type GutStats = {
  days: string[]
  /** Days with at least one entry of any kind; days with nothing logged are unknown, not "no poop". */
  trackedDays: string[]
  poops: PoopEntry[]
  symptoms: SymptomEntry[]
  perDay: number
  daysWithout: number
  longestGap: number
  byType: Record<number, number>
  byGroup: Record<BristolGroup, number>
  strainOrPain: number
}

export function gutStats(data: JournalData, days: string[], symptomFilter: SymptomType | 'all' = 'all'): GutStats {
  const set = new Set(days)
  const poops = data.poops.filter((item) => set.has(item.date))
  const symptoms = data.symptoms.filter((item) => set.has(item.date) && (symptomFilter === 'all' || item.type === symptomFilter))
  const byType: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
  const byGroup: Record<BristolGroup, number> = { hard: 0, formed: 0, soft: 0, loose: 0 }
  for (const poop of poops) {
    byType[poop.bristol] += 1
    byGroup[bristolGroup(poop.bristol)] += 1
  }
  const withPoop = new Set(poops.map((item) => item.date))
  const logged = new Set([
    ...data.meals.map((item) => item.date),
    ...data.poops.map((item) => item.date),
    ...data.symptoms.map((item) => item.date),
    ...data.waters.map((item) => item.date),
    ...data.dailyMetrics.map((item) => item.date),
  ])
  const trackedDays = days.filter((day) => logged.has(day))
  let gap = 0
  let longestGap = 0
  for (const day of days) {
    if (!logged.has(day)) {
      gap = 0
      continue
    }
    gap = withPoop.has(day) ? 0 : gap + 1
    longestGap = Math.max(longestGap, gap)
  }
  return {
    days,
    trackedDays,
    poops,
    symptoms,
    perDay: trackedDays.length ? poops.length / trackedDays.length : 0,
    daysWithout: trackedDays.filter((day) => !withPoop.has(day)).length,
    longestGap,
    byType,
    byGroup,
    strainOrPain: poops.filter((item) => item.straining || item.pain).length,
  }
}

function share(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0
}

/**
 * Plain-language patterns. Nothing is said about stool consistency until there are at
 * least `MIN_ENTRIES` bowel movements, so isolated entries never drive a conclusion.
 */
export function gutObservations(current: GutStats, previous: GutStats | null): string[] {
  const MIN_ENTRIES = 4
  const out: string[] = []
  const total = current.poops.length
  if (total < MIN_ENTRIES) {
    out.push(`${total} bowel movement${total === 1 ? '' : 's'} logged in this period — patterns are shown once at least ${MIN_ENTRIES} are recorded.`)
  } else {
    const tracked = current.trackedDays.length
    out.push(`About ${Math.round(current.perDay * 10) / 10} bowel movements per day on average (${total} over ${tracked} day${tracked === 1 ? '' : 's'} with entries${tracked < current.days.length ? `; ${current.days.length - tracked} day${current.days.length - tracked === 1 ? '' : 's'} had nothing logged` : ''}).`)
    const hard = share(current.byGroup.hard, total)
    const loose = share(current.byGroup.loose, total)
    const formed = share(current.byGroup.formed + current.byGroup.soft, total)
    out.push(`${formed}% were formed or soft (types 3–5).`)
    if (hard >= 25 || current.strainOrPain >= 3 || current.longestGap >= 3) {
      const parts = [
        hard >= 25 ? `${hard}% were hard (types 1–2)` : '',
        current.strainOrPain >= 3 ? `straining or pain was noted ${current.strainOrPain} times` : '',
        current.longestGap >= 3 ? `there were ${current.longestGap} days in a row with other entries but no bowel movement logged` : '',
      ].filter(Boolean)
      out.push(`Constipation-type pattern to keep an eye on: ${parts.join('; ')}.`)
    }
    if (loose >= 25) out.push(`Loose-stool pattern to keep an eye on: ${loose}% were loose or watery (types 6–7).`)
  }
  if (previous && previous.poops.length >= MIN_ENTRIES && total >= MIN_ENTRIES) {
    const diff = current.perDay - previous.perDay
    if (Math.abs(diff) >= 0.3) out.push(`Bowel movements were ${diff > 0 ? 'more' : 'less'} frequent than the previous period (${Math.round(previous.perDay * 10) / 10} per day before).`)
    const hardBefore = share(previous.byGroup.hard, previous.poops.length)
    const hardNow = share(current.byGroup.hard, total)
    if (Math.abs(hardNow - hardBefore) >= 20) out.push(`Hard stools ${hardNow > hardBefore ? 'increased' : 'decreased'} compared with the previous period (${hardBefore}% → ${hardNow}%).`)
    const looseBefore = share(previous.byGroup.loose, previous.poops.length)
    const looseNow = share(current.byGroup.loose, total)
    if (Math.abs(looseNow - looseBefore) >= 20) out.push(`Loose stools ${looseNow > looseBefore ? 'increased' : 'decreased'} compared with the previous period (${looseBefore}% → ${looseNow}%).`)
  }
  if (current.symptoms.length) {
    const counts = new Map<string, number>()
    for (const symptom of current.symptoms) counts.set(symptomLabel(symptom), (counts.get(symptomLabel(symptom)) ?? 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])
    out.push(`Symptoms recorded: ${top.map(([name, count]) => `${name.toLowerCase()} ${count}×`).join(', ')}.`)
  }
  return out
}
