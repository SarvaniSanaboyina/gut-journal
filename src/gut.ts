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
  { id: 'hard', label: 'Hard stools', range: 'Types 1–2', color: '#8b5a2b' },
  { id: 'formed', label: 'Formed stools', range: 'Types 3–4', color: '#5f9e6e' },
  { id: 'soft', label: 'Soft pieces', range: 'Type 5', color: '#d9a441' },
  { id: 'loose', label: 'Loose or watery', range: 'Types 6–7', color: '#6b9ad8' },
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
