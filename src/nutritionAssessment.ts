import { NUTRIENT_ORDER, NUTRIENTS, referenceValues, summarise, type ItemEstimate, type ReferenceBand } from './nutrition'
import type { FoodEntry, MealEntry, NutrientKey, Settings } from './types'

/**
 * Nutrient-specific daily intake assessment.
 *
 * Each nutrient is judged by its own kind of recommendation, not by averaging percentages:
 *
 * - Energy: an estimated requirement, so both too little and too much matter (range around EER).
 * - Protein, fibre, iron, calcium, zinc, vitamin C, vitamin D, omega-3: a recommended intake to
 *   reach (RDA / AI). Below is flagged; above is fine up to the Tolerable Upper Intake Level (UL)
 *   where one exists, and beyond the UL is flagged as a caution, never as "healthier".
 * - Carbohydrate and fat: judged as a share of the day's energy against the Acceptable
 *   Macronutrient Distribution Range (AMDR); protein above its AMDR is also flagged.
 *
 * Missing data is never counted as zero: a nutrient is assessed only when enough of the food eaten
 * has composition data, except where the known amount alone already settles the answer (e.g. a
 * known amount already above the UL).
 *
 * This is a screening aid for a conversation with a pediatrician, not a dietary assessment.
 */

// ---------------------------------------------------------------------------
// Reference data

/**
 * Tolerable Upper Intake Levels — US National Academies (IOM) DRIs, total intake per day.
 * ICMR-NIN 2020 sets few ULs for young children, so the IOM values are used. Ages 1–3 and 4–8
 * (applied to this app's 4–6 band). They apply to food plus supplements; this app counts food only.
 */
export const UPPER_LIMITS: Record<ReferenceBand, Partial<Record<NutrientKey, number>>> = {
  '1-3': { ironMg: 40, calciumMg: 2500, vitaminDUg: 63, zincMg: 7, vitaminCMg: 400 },
  '4-6': { ironMg: 40, calciumMg: 2500, vitaminDUg: 75, zincMg: 12, vitaminCMg: 650 },
}

/** Acceptable Macronutrient Distribution Ranges, % of energy (IOM, ages 1–3 and 4–18). */
export const AMDR: Record<ReferenceBand, Record<'proteinG' | 'carbsG' | 'fatG', [number, number]>> = {
  '1-3': { proteinG: [5, 20], carbsG: [45, 65], fatG: [30, 40] },
  '4-6': { proteinG: [10, 30], carbsG: [45, 65], fatG: [25, 35] },
}

const KCAL_PER_GRAM: Record<'proteinG' | 'carbsG' | 'fatG', number> = { proteinG: 4, carbsG: 4, fatG: 9 }

type Kind = 'energy' | 'minimum' | 'share'

const KINDS: Record<NutrientKey, Kind> = {
  energyKcal: 'energy',
  proteinG: 'minimum',
  carbsG: 'share',
  fatG: 'share',
  fibreG: 'minimum',
  ironMg: 'minimum',
  calciumMg: 'minimum',
  vitaminDUg: 'minimum',
  zincMg: 'minimum',
  vitaminCMg: 'minimum',
  omega3G: 'minimum',
}

// ---------------------------------------------------------------------------
// Configuration

export type AssessmentConfig = {
  /** Below this % of the reference a nutrient counts as below recommended intake. */
  lowPercent: number
  /** Energy above this % of the estimated requirement counts as above. */
  energyHighPercent: number
  /** A recommended-intake nutrient above this % of the reference (but under any UL) is "above". */
  aboveRecommendedPercent: number
  /** Share of eaten foods (by count) that need composition data before a nutrient is assessed. */
  minCoveragePercent: number
  /** If at least this % of the assessed key nutrients are below, the day is "below". */
  belowSharePercent: number
  /** Nutrients that decide the overall day status. Energy and protein are always required. */
  keyNutrients: NutrientKey[]
}

export const DEFAULT_ASSESSMENT: AssessmentConfig = {
  lowPercent: 80,
  energyHighPercent: 120,
  aboveRecommendedPercent: 150,
  minCoveragePercent: 90,
  belowSharePercent: 50,
  // Vitamin D (mainly from sunlight) and omega-3 (sparse composition data) are shown but do not
  // decide the day's colour by default.
  keyNutrients: ['energyKcal', 'proteinG', 'fibreG', 'ironMg', 'calciumMg', 'zincMg', 'vitaminCMg'],
}

export function assessmentConfig(settings: Settings): AssessmentConfig {
  const overrides = Object.fromEntries(Object.entries(settings.nutritionAssessment ?? {}).filter(([, value]) => value != null))
  return { ...DEFAULT_ASSESSMENT, ...overrides }
}

// ---------------------------------------------------------------------------
// Per-nutrient assessment

export type NutrientStatus = 'below' | 'within' | 'above' | 'over-ul' | 'insufficient'

export const NUTRIENT_STATUS_META: Record<NutrientStatus, { label: string; short: string }> = {
  below: { label: 'Below recommended intake', short: 'Below' },
  within: { label: 'Within recommended range', short: 'Within' },
  above: { label: 'Above recommended intake', short: 'Above' },
  'over-ul': { label: 'Exceeds the upper limit', short: 'Over limit' },
  insufficient: { label: 'Insufficient data', short: 'No data' },
}

export type NutrientAssessment = {
  key: NutrientKey
  /** Sum of the known values; a lower bound when `partial`. */
  amount: number
  partial: boolean
  /** Eaten foods with a value for this nutrient / eaten foods. */
  covered: number
  eaten: number
  reference: number | null
  upperLimit: number | null
  /** For carbohydrate, fat and protein: % of the day's energy, and the acceptable range. */
  energyShare: number | null
  amdr: [number, number] | null
  percentOfReference: number | null
  status: NutrientStatus
  /** Plain-language explanation of the status. */
  note: string
}

function fmt(key: NutrientKey, value: number) {
  const meta = NUTRIENTS[key]
  return `${Math.round(value * 10 ** meta.digits) / 10 ** meta.digits} ${meta.unit}`
}

function assessOne(
  key: NutrientKey,
  items: ItemEstimate[],
  references: Record<NutrientKey, number | null>,
  band: ReferenceBand,
  config: AssessmentConfig,
  energy: { amount: number; complete: boolean },
): NutrientAssessment {
  const eatenItems = items.filter((item) => item.status !== 'refused')
  const covered = eatenItems.filter((item) => (item.status === 'estimated' || item.status === 'label') && item.values[key] != null)
  const amount = covered.reduce((sum, item) => sum + (item.values[key] ?? 0), 0)
  const eaten = eatenItems.length
  const complete = eaten === 0 || (covered.length / eaten) * 100 >= config.minCoveragePercent
  const partial = covered.length < eaten
  const reference = references[key]
  const upperLimit = UPPER_LIMITS[band][key] ?? null
  const amdr = key === 'proteinG' || key === 'carbsG' || key === 'fatG' ? AMDR[band][key] : null
  const energyShare =
    amdr && energy.amount > 0 && (key === 'proteinG' || key === 'carbsG' || key === 'fatG')
      ? ((amount * KCAL_PER_GRAM[key]) / energy.amount) * 100
      : null
  const percentOfReference = reference ? (amount / reference) * 100 : null
  const base = { key, amount, partial, covered: covered.length, eaten, reference, upperLimit, energyShare, amdr, percentOfReference }
  const result = (status: NutrientStatus, note: string): NutrientAssessment => ({ ...base, status, note })

  // A known amount above the upper limit is certain however much data is missing.
  if (upperLimit != null && amount > upperLimit) {
    return result('over-ul', `${partial ? 'At least ' : ''}${fmt(key, amount)} is above the upper limit of ${fmt(key, upperLimit)} for this age.`)
  }

  const kind = KINDS[key]
  if (kind === 'energy') {
    if (!reference) return result('insufficient', 'No reference value.')
    const pct = percentOfReference!
    if (pct > config.energyHighPercent) return result('above', `${partial ? 'At least ' : ''}${Math.round(pct)}% of the estimated requirement.`)
    if (!complete) return result('insufficient', `Only ${covered.length} of ${eaten} foods eaten have energy data.`)
    if (pct < config.lowPercent) return result('below', `${Math.round(pct)}% of the estimated requirement.`)
    return result('within', `${Math.round(pct)}% of the estimated requirement.`)
  }

  if (kind === 'share') {
    // Nothing eaten (every meal skipped or refused) is a recorded zero, not missing data.
    if (eaten === 0) return result('below', 'No food was eaten.')
    // Judged as % of energy; needs both this nutrient and energy to be reasonably complete.
    if (!complete || !energy.complete || energyShare == null) {
      return result('insufficient', !complete ? `Only ${covered.length} of ${eaten} foods eaten have data.` : 'Energy could not be estimated, so its share of energy is unknown.')
    }
    const [low, high] = amdr!
    if (energyShare < low) return result('below', `${Math.round(energyShare)}% of energy (recommended ${low}–${high}%).`)
    if (energyShare > high) return result('above', `${Math.round(energyShare)}% of energy (recommended ${low}–${high}%).`)
    return result('within', `${Math.round(energyShare)}% of energy (recommended ${low}–${high}%).`)
  }

  // Recommended-intake nutrients (protein also has an AMDR ceiling).
  if (!reference) return result('insufficient', 'No reference value for this age.')
  const pct = percentOfReference!
  if (key === 'proteinG' && amdr && energyShare != null && energy.complete && complete && energyShare > amdr[1]) {
    return result('above', `${Math.round(energyShare)}% of energy from protein (recommended up to ${amdr[1]}%).`)
  }
  if (pct >= config.lowPercent) {
    const qualifier = partial ? 'At least ' : ''
    if (pct > config.aboveRecommendedPercent) {
      return result('above', `${qualifier}${Math.round(pct)}% of the recommended intake${upperLimit ? `, under the upper limit of ${fmt(key, upperLimit)}` : ''}.`)
    }
    return result('within', `${qualifier}${Math.round(pct)}% of the recommended intake.`)
  }
  if (!complete) return result('insufficient', `Only ${covered.length} of ${eaten} foods eaten have data, and the known amount is below the recommendation.`)
  return result('below', `${Math.round(pct)}% of the recommended intake.`)
}

// ---------------------------------------------------------------------------
// Day assessment

export type DayNutritionStatus = 'below' | 'within' | 'above' | 'insufficient'

export const DAY_STATUS_META: Record<DayNutritionStatus, { label: string; legend: string; color: string }> = {
  below: { label: 'Below range', legend: 'Nutrition generally below the reference range', color: '#FFF3B0' },
  within: { label: 'Within range', legend: 'Nutrition generally within the reference range', color: '#C8E6C9' },
  above: { label: 'Above range', legend: 'Above the usual range or an upper limit', color: '#BBDEFB' },
  insufficient: { label: 'Assessment unavailable', legend: 'All meals recorded, not enough nutrient data', color: '#E0E0E0' },
}

export type DayNutrition = {
  status: DayNutritionStatus
  reasons: string[]
  nutrients: NutrientAssessment[]
  /** Foods that could not be estimated, with why. */
  missing: { name: string; reason: string }[]
  band: ReferenceBand
  referenceNote: string
  overUpperLimit: NutrientKey[]
}

export function assessDay(meals: MealEntry[], foods: FoodEntry[], settings: Settings, date: string): DayNutrition {
  const config = assessmentConfig(settings)
  const refs = referenceValues(settings, date)
  const summary = summarise(meals, foods)
  const items = summary.items
  const untracked = summary.untracked
  // Free-text meals (no food items) cannot be estimated: count each as one food without data.
  const placeholder: ItemEstimate[] = Array.from({ length: untracked }, () => ({
    name: 'Meal described in text only',
    status: 'missing' as const,
    reason: 'No foods listed',
    grams: null,
    genericMeasure: false,
    values: Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, null])) as ItemEstimate['values'],
  }))
  const all = [...items, ...placeholder]

  const energyAssessment = assessOne('energyKcal', all, refs.values, refs.band, config, { amount: 0, complete: false })
  const energyComplete = energyAssessment.eaten === 0 || (energyAssessment.covered / energyAssessment.eaten) * 100 >= config.minCoveragePercent
  const energy = { amount: energyAssessment.amount, complete: energyComplete }
  const nutrients = NUTRIENT_ORDER.map((key) => (key === 'energyKcal' ? energyAssessment : assessOne(key, all, refs.values, refs.band, config, energy)))
  const byKey = Object.fromEntries(nutrients.map((item) => [item.key, item])) as Record<NutrientKey, NutrientAssessment>
  const missing = all.filter((item) => item.status === 'missing').map((item) => ({ name: item.name, reason: item.reason }))
  const overUpperLimit = nutrients.filter((item) => item.status === 'over-ul').map((item) => item.key)
  const base = { nutrients, missing, band: refs.band, referenceNote: refs.note, overUpperLimit }

  // A day where every meal was skipped (or every food refused) is still a logged day: it is
  // assessed as zero intake rather than set aside, so the nutrition shortfall is visible.
  const eatenCount = all.filter((item) => item.status !== 'refused').length
  const noFoodReason = eatenCount === 0 ? ['No food was eaten — every meal was skipped or refused.'] : []

  const keys = [...new Set<NutrientKey>(['energyKcal', 'proteinG', ...config.keyNutrients])]
  const key = keys.map((nutrient) => byKey[nutrient])
  const insufficient = key.filter((item) => item.status === 'insufficient')
  if (byKey.energyKcal.status === 'insufficient' || byKey.proteinG.status === 'insufficient') {
    return { ...base, status: 'insufficient', reasons: [...noFoodReason, 'Energy and protein could not both be estimated from the foods recorded.'] }
  }
  if (insufficient.length * 3 > key.length) {
    return { ...base, status: 'insufficient', reasons: [...noFoodReason, `${insufficient.length} of ${key.length} key nutrients lack enough data.`] }
  }

  const reasons: string[] = []
  const overKey = key.filter((item) => item.status === 'over-ul')
  if (overKey.length) {
    reasons.push(`${overKey.map((item) => NUTRIENTS[item.key].label).join(', ')} above the upper limit.`)
    return { ...base, status: 'above', reasons: [...noFoodReason, ...reasons] }
  }
  if (byKey.energyKcal.status === 'above') return { ...base, status: 'above', reasons: [...noFoodReason, 'Energy is above the usual range.'] }
  if (byKey.proteinG.status === 'above' && byKey.proteinG.energyShare != null && byKey.proteinG.amdr && byKey.proteinG.energyShare > byKey.proteinG.amdr[1]) {
    return { ...base, status: 'above', reasons: [...noFoodReason, 'Protein supplies more energy than the recommended range.'] }
  }

  const assessed = key.filter((item) => item.status !== 'insufficient')
  const below = assessed.filter((item) => item.status === 'below')
  if (byKey.energyKcal.status === 'below') reasons.push('Energy is below the estimated requirement.')
  const belowOthers = below.filter((item) => item.key !== 'energyKcal')
  if (belowOthers.length) reasons.push(`Below the recommendation: ${belowOthers.map((item) => NUTRIENTS[item.key].label.toLowerCase()).join(', ')}.`)
  if (byKey.energyKcal.status === 'below' || (assessed.length && (below.length / assessed.length) * 100 >= config.belowSharePercent)) {
    return { ...base, status: 'below', reasons: [...noFoodReason, ...reasons] }
  }
  return { ...base, status: 'within', reasons: reasons.length ? reasons : ['Key nutrients are within their recommended ranges.'] }
}

// ---------------------------------------------------------------------------
// Calendar state: meal tracking first, then nutrition

export type CalendarState = 'not-logged' | DayNutritionStatus

export const CALENDAR_META: Record<CalendarState, { label: string; legend: string; color: string }> = {
  ...DAY_STATUS_META,
  'not-logged': { label: 'Meals not logged', legend: 'One or more of the five meals not logged', color: '#FFCDD2' },
}

export const CALENDAR_LEGEND_ORDER: CalendarState[] = ['below', 'within', 'above', 'not-logged', 'insufficient']

/**
 * The calendar colour for a day. Meal tracking comes first: any Not logged slot makes the day red
 * regardless of the nutrient estimates, because missing meals are not zero intake. A skipped meal
 * (marked Not eaten) is a logged meal, so a fully recorded day — even one where every meal was
 * skipped — gets a nutrition colour and assessment. `meals` should include "Other" meals, which
 * count for nutrition even though they are not one of the five slots.
 */
export function calendarState(
  slotsComplete: boolean,
  meals: MealEntry[],
  foods: FoodEntry[],
  settings: Settings,
  date: string,
): { state: CalendarState; nutrition: DayNutrition | null } {
  if (!slotsComplete) return { state: 'not-logged', nutrition: null }
  const nutrition = assessDay(meals, foods, settings, date)
  return { state: nutrition.status, nutrition }
}
