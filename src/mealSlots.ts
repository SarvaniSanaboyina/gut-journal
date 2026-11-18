import { consumedPercent, foodMap, gramsFor } from './foods'
import type {
  CalendarThresholds,
  FoodEntry,
  JournalData,
  MealEntry,
  PoopEntry,
  SlotStatus,
  SlotType,
  SymptomEntry,
  WaterEntry,
} from './types'
import { totalWaterMl } from './water'

/**
 * The daily meal schedule: five slots per date, each Eaten / Not eaten / Not logged.
 *
 * - Eaten: at least one meal entry of that type on that date.
 * - Not eaten: the parent explicitly marked it (stored in `mealSlots`).
 * - Not logged: neither. Missing data is never treated as skipped or as zero intake.
 *
 * "Other" meals still count for nutrition but are not one of the five slots.
 */

export const SLOTS: { id: SlotType; label: string; kind: 'main' | 'snack' }[] = [
  { id: 'breakfast', label: 'Breakfast', kind: 'main' },
  { id: 'morning-snack', label: 'Morning snack', kind: 'snack' },
  { id: 'lunch', label: 'Lunch', kind: 'main' },
  { id: 'evening-snack', label: 'Evening snack', kind: 'snack' },
  { id: 'dinner', label: 'Dinner', kind: 'main' },
]

export const SLOT_COUNT = SLOTS.length

export function isSlotType(type: string): type is SlotType {
  return SLOTS.some((slot) => slot.id === type)
}

export const DEFAULT_THRESHOLDS: CalendarThresholds = { lessBelow: 50, moreAbove: 100 }

// ---------------------------------------------------------------------------
// Per-date index, so a month of calendar cells is one pass over the data.

export type DayRecords = {
  meals: MealEntry[]
  skipped: Set<SlotType>
  skipNotes: Map<SlotType, string>
  waters: WaterEntry[]
  poops: PoopEntry[]
  symptoms: SymptomEntry[]
}

export type DayIndex = Map<string, DayRecords>

function emptyDay(): DayRecords {
  return { meals: [], skipped: new Set(), skipNotes: new Map(), waters: [], poops: [], symptoms: [] }
}

export function buildDayIndex(data: Pick<JournalData, 'meals' | 'mealSlots' | 'waters' | 'poops' | 'symptoms'>): DayIndex {
  const index: DayIndex = new Map()
  const day = (date: string) => {
    let entry = index.get(date)
    if (!entry) {
      entry = emptyDay()
      index.set(date, entry)
    }
    return entry
  }
  for (const meal of data.meals) day(meal.date).meals.push(meal)
  for (const slot of data.mealSlots) {
    const entry = day(slot.date)
    entry.skipped.add(slot.mealType)
    entry.skipNotes.set(slot.mealType, slot.note)
  }
  for (const water of data.waters) day(water.date).waters.push(water)
  for (const poop of data.poops) day(poop.date).poops.push(poop)
  for (const symptom of data.symptoms) day(symptom.date).symptoms.push(symptom)
  return index
}

export function dayRecords(index: DayIndex, date: string): DayRecords {
  return index.get(date) ?? emptyDay()
}

// ---------------------------------------------------------------------------
// Slots and completion

export type SlotState = {
  slot: (typeof SLOTS)[number]
  status: SlotStatus
  meals: MealEntry[]
  note: string
  /** Share of what was served that was eaten, 0–300; null when amounts were not recorded or not eaten/logged. */
  percent: number | null
}

/**
 * Consumption for one slot's meals. Items whose served amount converts to grams are weighted by
 * weight; otherwise every item counts as one equal portion. Unknown amounts make the slot unknown,
 * rather than being guessed.
 */
export function slotPercent(meals: MealEntry[], foods: Map<string, FoodEntry>): number | null {
  const items = meals.flatMap((meal) => meal.items)
  if (items.length === 0) return null
  const percents = items.map((item) => consumedPercent(item))
  if (percents.some((value) => value == null)) return null
  const grams = items.map((item) => gramsFor(item.foodId ? foods.get(item.foodId) : undefined, item.quantityServed, item.unit)?.grams ?? null)
  if (grams.every((value) => value != null && value > 0)) {
    const served = grams.reduce((sum, value) => sum! + value!, 0)!
    const eaten = grams.reduce((sum, value, index) => sum! + (value! * percents[index]!) / 100, 0)!
    return (eaten / served) * 100
  }
  return percents.reduce((sum, value) => sum! + value!, 0)! / percents.length
}

export function daySlots(records: DayRecords, foods: Map<string, FoodEntry>): SlotState[] {
  return SLOTS.map((slot) => {
    const meals = records.meals.filter((meal) => meal.type === slot.id)
    // A logged meal always wins: the server clears "not eaten" when food is saved for the slot.
    const status: SlotStatus = meals.length ? 'eaten' : records.skipped.has(slot.id) ? 'not-eaten' : 'not-logged'
    return {
      slot,
      status,
      meals,
      note: records.skipNotes.get(slot.id) ?? '',
      percent: status === 'eaten' ? slotPercent(meals, foods) : status === 'not-eaten' ? 0 : null,
    }
  })
}

export type Completion = 'complete' | 'incomplete' | 'not-logged'

export type DayCompletion = {
  status: Completion
  eaten: number
  skipped: number
  notLogged: number
}

export function dayCompletion(slots: SlotState[]): DayCompletion {
  const eaten = slots.filter((slot) => slot.status === 'eaten').length
  const skipped = slots.filter((slot) => slot.status === 'not-eaten').length
  const notLogged = slots.length - eaten - skipped
  return {
    status: notLogged === 0 ? 'complete' : notLogged === slots.length ? 'not-logged' : 'incomplete',
    eaten,
    skipped,
    notLogged,
  }
}

export const COMPLETION_LABEL: Record<Completion, string> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  'not-logged': 'Not logged',
}

// ---------------------------------------------------------------------------
// Consumption state for the calendar

export type ConsumptionState = 'not-logged' | 'all-skipped' | 'unknown' | 'less' | 'enough' | 'more'

export const CONSUMPTION_META: Record<ConsumptionState, { label: string; legend: string; color: string }> = {
  less: { label: 'Less', legend: 'Less consumed', color: '#FFF3B0' },
  enough: { label: 'Enough', legend: 'Enough consumed', color: '#C8E6C9' },
  more: { label: 'More', legend: 'More than usual', color: '#BBDEFB' },
  'not-logged': { label: 'Not logged', legend: 'Meals not logged', color: '#FFCDD2' },
  'all-skipped': { label: 'All skipped', legend: 'All meals marked not eaten', color: '#E0E0E0' },
  unknown: { label: 'Amounts missing', legend: 'Logged, amounts not recorded', color: '#F5F5F5' },
}

export type DayConsumption = { state: ConsumptionState; percent: number | null }

/**
 * Day consumption = average of the five slot percentages (each scheduled slot is one portion;
 * a slot marked Not eaten counts as 0 %). No percentage is computed while any slot is Not logged,
 * so missing data never looks like low intake.
 */
export function dayConsumption(slots: SlotState[], thresholds: CalendarThresholds = DEFAULT_THRESHOLDS): DayConsumption {
  if (slots.some((slot) => slot.status === 'not-logged')) return { state: 'not-logged', percent: null }
  if (slots.every((slot) => slot.status === 'not-eaten')) return { state: 'all-skipped', percent: 0 }
  if (slots.some((slot) => slot.percent == null)) return { state: 'unknown', percent: null }
  const percent = slots.reduce((sum, slot) => sum + slot.percent!, 0) / slots.length
  const state: ConsumptionState = percent < thresholds.lessBelow ? 'less' : percent > thresholds.moreAbove ? 'more' : 'enough'
  return { state, percent }
}

// ---------------------------------------------------------------------------
// Water and bowel movements

/** Total ml for the day, or null when no water entry exists (an explicit 0 ml entry gives 0). */
export function dayWaterMl(waters: WaterEntry[]): number | null {
  return waters.length ? totalWaterMl(waters) : null
}

export function bowelIndicator(poops: PoopEntry[]) {
  return { count: poops.length, show: poops.length > 0 }
}

// ---------------------------------------------------------------------------
// Everything a calendar cell or day sheet needs

export type DaySummary = {
  date: string
  records: DayRecords
  slots: SlotState[]
  completion: DayCompletion
  consumption: DayConsumption
  waterMl: number | null
  bowelMovements: number
}

export function summariseDay(
  index: DayIndex,
  date: string,
  foods: Map<string, FoodEntry>,
  thresholds: CalendarThresholds = DEFAULT_THRESHOLDS,
): DaySummary {
  const records = dayRecords(index, date)
  const slots = daySlots(records, foods)
  return {
    date,
    records,
    slots,
    completion: dayCompletion(slots),
    consumption: dayConsumption(slots, thresholds),
    waterMl: dayWaterMl(records.waters),
    bowelMovements: bowelIndicator(records.poops).count,
  }
}

/** Convenience for one-off use (the Diary); the calendar builds the index once per month. */
export function summariseDate(data: JournalData, date: string): DaySummary {
  return summariseDay(buildDayIndex(data), date, foodMap(data.foods))
}
