import { parseISODate, shiftDate } from './dates'
import { consumedPercent, consumedQuantity, eatenFoods, foodMap, FOOD_GROUPS, gramsFor, wasEaten } from './foods'
import type {
  FoodEntry,
  FoodGroup,
  JournalData,
  MealEntry,
  MealIngredient,
  MealItem,
  NutrientKey,
  Nutrients,
  Settings,
} from './types'

export const NUTRIENTS: Record<NutrientKey, { label: string; unit: string; digits: number }> = {
  energyKcal: { label: 'Energy', unit: 'kcal', digits: 0 },
  proteinG: { label: 'Protein', unit: 'g', digits: 1 },
  carbsG: { label: 'Carbohydrates', unit: 'g', digits: 0 },
  fatG: { label: 'Fat', unit: 'g', digits: 1 },
  fibreG: { label: 'Fibre', unit: 'g', digits: 1 },
  ironMg: { label: 'Iron', unit: 'mg', digits: 1 },
  calciumMg: { label: 'Calcium', unit: 'mg', digits: 0 },
  vitaminDUg: { label: 'Vitamin D', unit: 'µg', digits: 1 },
  zincMg: { label: 'Zinc', unit: 'mg', digits: 1 },
  vitaminCMg: { label: 'Vitamin C', unit: 'mg', digits: 0 },
  omega3G: { label: 'Omega-3', unit: 'g', digits: 2 },
}

export const NUTRIENT_ORDER = Object.keys(NUTRIENTS) as NutrientKey[]

export function formatNutrient(key: NutrientKey, value: number) {
  const meta = NUTRIENTS[key]
  const factor = 10 ** meta.digits
  return `${Math.round(value * factor) / factor} ${meta.unit}`
}

// ---------------------------------------------------------------------------
// Reference values

export type ReferenceBand = '1-3' | '4-6'

/**
 * Default daily reference values. ICMR-NIN 2020 Nutrient Requirements for Indians
 * (RDA, or EAR/EER where no RDA exists) for children 1–3 and 4–6 years. Omega-3 has no
 * ICMR value; the US IOM Adequate Intake for alpha-linolenic acid is used. Total fat
 * has no single target for this age, so it is shown without a reference.
 */
export const DEFAULT_REFERENCES: Record<ReferenceBand, Record<NutrientKey, number | null>> = {
  '1-3': {
    energyKcal: 1110,
    proteinG: 12.5,
    carbsG: 100,
    fatG: null,
    fibreG: 15,
    ironMg: 8,
    calciumMg: 500,
    vitaminDUg: 15,
    zincMg: 3.3,
    vitaminCMg: 27,
    omega3G: 0.7,
  },
  '4-6': {
    energyKcal: 1360,
    proteinG: 16,
    carbsG: 100,
    fatG: null,
    fibreG: 20,
    ironMg: 11,
    calciumMg: 550,
    vitaminDUg: 15,
    zincMg: 4.5,
    vitaminCMg: 32,
    omega3G: 0.9,
  },
}

export function ageInMonths(birthDate: string, onISO: string): number | null {
  if (!birthDate) return null
  const birth = parseISODate(birthDate)
  const on = parseISODate(onISO)
  let months = (on.getFullYear() - birth.getFullYear()) * 12 + (on.getMonth() - birth.getMonth())
  if (on.getDate() < birth.getDate()) months -= 1
  return months
}

export function formatAge(months: number) {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} month${rest === 1 ? '' : 's'}`
  return rest ? `${years} y ${rest} m` : `${years} year${years === 1 ? '' : 's'}`
}

export function referenceValues(settings: Settings, onISO: string) {
  const months = ageInMonths(settings.childProfile.birthDate, onISO)
  const band: ReferenceBand = months != null && months >= 48 ? '4-6' : '1-3'
  const custom = settings.nutrientReferences.custom
  const values = { ...DEFAULT_REFERENCES[band] }
  for (const key of NUTRIENT_ORDER) {
    if (custom[key] != null) values[key] = custom[key]!
  }
  let note = `ICMR-NIN 2020 reference values for children ${band} years.`
  if (months == null) note = 'Add a date of birth in Settings to use age-based values. Showing the 1–3 years values.'
  else if (months < 12) note = 'ICMR-NIN 2020 values for 1–3 years are shown; under 12 months, breast milk or formula is still a main source — ask your pediatrician.'
  else if (months >= 84) note = 'Showing the 4–6 years values; your child is older than this app’s age range.'
  return { values, band, months, note, customKeys: NUTRIENT_ORDER.filter((key) => custom[key] != null) }
}

// ---------------------------------------------------------------------------
// Per-item estimates

export type EstimateStatus = 'estimated' | 'label' | 'missing' | 'refused'

export type ItemEstimate = {
  name: string
  status: EstimateStatus
  reason: string
  grams: number | null
  genericMeasure: boolean
  values: Nutrients
}

function emptyValues(fill: number | null): Nutrients {
  return Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, fill])) as Nutrients
}

function estimateIngredient(item: MealIngredient, food: FoodEntry | undefined, scale = 1): ItemEstimate {
  const base = { name: item.name, grams: null, genericMeasure: false }
  if (!wasEaten(item)) return { ...base, status: 'refused', reason: 'Refused', grams: 0, values: emptyValues(0) }
  const quantity = consumedQuantity(item)
  if (quantity == null) return { ...base, status: 'missing', reason: 'Amount eaten not recorded', values: emptyValues(null) }
  if (!food) return { ...base, status: 'missing', reason: 'Not in the food list', values: emptyValues(null) }
  if (food.nutrientSource === 'none') return { ...base, status: 'missing', reason: 'No nutrient data for this food', values: emptyValues(null) }
  const converted = gramsFor(food, quantity * scale, item.unit)
  if (!converted) return { ...base, status: 'missing', reason: `Weight of one ${item.unit === 'pieces' ? 'piece' : item.unit} unknown`, values: emptyValues(null) }
  const values = emptyValues(null)
  for (const key of NUTRIENT_ORDER) {
    const per100 = food.nutrients[key]
    values[key] = per100 == null ? null : (per100 * converted.grams) / 100
  }
  return {
    name: item.name,
    status: food.nutrientSource === 'label' ? 'label' : 'estimated',
    reason:
      food.nutrientSource === 'label'
        ? 'From pack label'
        : `${food.nutrientSource === 'ifct' ? 'IFCT 2017' : food.nutrientSource === 'recipe' ? 'IFCT 2017 recipe' : 'Approximate value'}${converted.generic ? ', standard household measure' : ''}`,
    grams: converted.grams,
    genericMeasure: converted.generic,
    values,
  }
}

/**
 * A dish uses its own nutrient data. Only when the dish has none, its ingredients
 * (each with an amount) are summed, scaled by how much of the dish was eaten.
 */
export function estimateItem(item: MealItem, foods: Map<string, FoodEntry>): ItemEstimate {
  const own = estimateIngredient(item, item.foodId ? foods.get(item.foodId) : undefined)
  if (own.status !== 'missing' || item.ingredients.length === 0) return own
  if (own.reason === 'Amount eaten not recorded' && consumedPercent(item) == null) return own
  const scale = (consumedPercent(item) ?? 100) / 100
  const parts = item.ingredients.map((child) =>
    estimateIngredient({ ...child, consumedPercent: child.consumedPercent ?? 100 }, child.foodId ? foods.get(child.foodId) : undefined, scale),
  )
  if (parts.some((part) => part.status === 'missing')) return own
  const values = emptyValues(0)
  for (const part of parts) {
    for (const key of NUTRIENT_ORDER) {
      const value = part.values[key]
      values[key] = values[key] == null || value == null ? null : values[key]! + value
    }
  }
  return {
    name: item.name,
    status: parts.some((part) => part.status === 'label') ? 'label' : 'estimated',
    reason: 'Estimate from ingredients',
    grams: parts.reduce((sum, part) => sum + (part.grams ?? 0), 0),
    genericMeasure: parts.some((part) => part.genericMeasure),
    values,
  }
}

export type NutrientTotals = Record<NutrientKey, { value: number; unknown: number }>

export type NutritionSummary = {
  items: (ItemEstimate & { mealId: string })[]
  totals: NutrientTotals
  counted: number
  missing: number
  refused: number
  /** Meals with only a free-text description: nothing can be estimated from them. */
  untracked: number
  enteredCalories: number | null
}

export function summarise(meals: MealEntry[], foods: FoodEntry[]): NutritionSummary {
  const byId = foodMap(foods)
  const items = meals.flatMap((meal) => meal.items.map((item) => ({ ...estimateItem(item, byId), mealId: meal.id })))
  const totals = Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, { value: 0, unknown: 0 }])) as NutrientTotals
  for (const item of items) {
    if (item.status === 'refused') continue
    for (const key of NUTRIENT_ORDER) {
      const value = item.values[key]
      if (value == null) totals[key].unknown += 1
      else totals[key].value += value
    }
  }
  const untracked = meals.filter((meal) => meal.items.length === 0).length
  for (const key of NUTRIENT_ORDER) totals[key].unknown += untracked
  const entered = meals.filter((meal) => meal.calories != null)
  return {
    items,
    totals,
    counted: items.filter((item) => item.status === 'estimated' || item.status === 'label').length,
    missing: items.filter((item) => item.status === 'missing').length,
    refused: items.filter((item) => item.status === 'refused').length,
    untracked,
    enteredCalories: entered.length ? entered.reduce((sum, meal) => sum + (meal.calories ?? 0), 0) : null,
  }
}

/** Average daily totals over the days that have at least one meal logged. */
export function averageTotals(data: JournalData, days: string[]) {
  const logged = days.filter((day) => data.meals.some((meal) => meal.date === day))
  const perDay = logged.map((day) => summarise(data.meals.filter((meal) => meal.date === day), data.foods))
  const average = Object.fromEntries(
    NUTRIENT_ORDER.map((key) => [
      key,
      {
        value: perDay.length ? perDay.reduce((sum, day) => sum + day.totals[key].value, 0) / perDay.length : 0,
        unknown: perDay.reduce((sum, day) => sum + day.totals[key].unknown, 0),
      },
    ]),
  ) as NutrientTotals
  return { average, loggedDays: logged.length, perDay: logged.map((day, index) => ({ day, summary: perDay[index] })) }
}

// ---------------------------------------------------------------------------
// Food groups and variety

export type GroupCoverage = Record<FoodGroup, { servings: number; foods: string[] }>

export function groupCoverage(meals: MealEntry[], foods: FoodEntry[]): GroupCoverage {
  const byId = foodMap(foods)
  const coverage = Object.fromEntries(FOOD_GROUPS.map((group) => [group.id, { servings: 0, foods: [] as string[] }])) as GroupCoverage
  for (const meal of meals) {
    for (const { foodId, name, parent } of eatenFoods(meal)) {
      const food = foodId ? byId.get(foodId) : undefined
      if (!food) continue
      for (const group of food.groups) {
        // An ingredient of a dish counts towards a group once per dish, not as a separate serving.
        if (!parent) coverage[group].servings += 1
        else if (!byId.get(parent.foodId ?? '')?.groups.includes(group)) coverage[group].servings += 1
        if (!coverage[group].foods.includes(name)) coverage[group].foods.push(name)
      }
    }
  }
  return coverage
}

export function distinctFoods(meals: MealEntry[]) {
  const names = new Map<string, string>()
  for (const meal of meals) for (const food of eatenFoods(meal)) names.set(food.key, food.name)
  return [...names.values()]
}

export type WeekGroupGrid = { days: string[]; logged: Set<string>; byGroup: Record<FoodGroup, Set<string>> }

export function weekGroupGrid(data: JournalData, days: string[]): WeekGroupGrid {
  const byGroup = Object.fromEntries(FOOD_GROUPS.map((group) => [group.id, new Set<string>()])) as Record<FoodGroup, Set<string>>
  const logged = new Set<string>()
  for (const day of days) {
    const meals = data.meals.filter((meal) => meal.date === day)
    if (meals.length) logged.add(day)
    const coverage = groupCoverage(meals, data.foods)
    for (const group of FOOD_GROUPS) if (coverage[group.id].servings > 0) byGroup[group.id].add(day)
  }
  return { days, logged, byGroup }
}

// ---------------------------------------------------------------------------
// Insights

function foodsMatching(data: JournalData, days: string[], test: (food: FoodEntry) => boolean) {
  const byId = foodMap(data.foods)
  const daysWith = new Set<string>()
  const names = new Set<string>()
  for (const meal of data.meals.filter((item) => days.includes(item.date))) {
    for (const { foodId, name } of eatenFoods(meal)) {
      const food = foodId ? byId.get(foodId) : undefined
      if (food && test(food)) {
        daysWith.add(meal.date)
        names.add(name)
      }
    }
  }
  return { days: daysWith.size, names: [...names] }
}

function listNames(names: string[], max = 4) {
  const lower = names.slice(0, max).map((name) => name.toLowerCase())
  if (lower.length <= 1) return lower.join('')
  return `${lower.slice(0, -1).join(', ')} and ${lower.at(-1)}`
}

const GROUP_PHRASE: Record<FoodGroup, string> = {
  carbohydrate: 'Grains and other carbohydrate foods were',
  protein: 'Protein foods were',
  vegetable: 'Vegetables were',
  fruit: 'Fruits were',
  fat: 'Healthy fats were',
}

/** Week-level observations for the 7 days ending `endISO`, compared with the 7 days before. */
export function nutritionInsights(data: JournalData, endISO: string): string[] {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(endISO, index - 6))
  const previous = days.map((day) => shiftDate(day, -7))
  const grid = weekGroupGrid(data, days)
  const tracked = grid.logged.size
  const out: string[] = []
  if (tracked < 3) {
    return [`Meals were logged on ${tracked} of the last 7 days. Weekly patterns appear once meals are logged on at least 3 days.`]
  }
  const of = tracked === 7 ? 'of the last 7 days' : `of the ${tracked} days with meals logged`
  for (const group of ['vegetable', 'fruit', 'protein'] as FoodGroup[]) {
    out.push(`${GROUP_PHRASE[group]} recorded on ${grid.byGroup[group].size} ${of}.`)
  }

  const fruitsNow = foodsMatching(data, days, (food) => food.groups.includes('fruit')).names
  const fruitsBefore = foodsMatching(data, previous, (food) => food.groups.includes('fruit')).names
  if (previous.some((day) => data.meals.some((meal) => meal.date === day))) {
    if (fruitsNow.length > fruitsBefore.length) out.push(`Fruit variety increased this week (${fruitsNow.length} different fruits, up from ${fruitsBefore.length}).`)
    else if (fruitsNow.length < fruitsBefore.length) out.push(`Fruit variety was lower this week (${fruitsNow.length} different fruits, down from ${fruitsBefore.length}).`)
  }

  const protein = foodsMatching(data, days, (food) => food.groups.includes('protein')).names
  if (protein.length) out.push(`Protein sources included ${listNames(protein)}.`)

  const fibre = foodsMatching(data, days, (food) => (food.nutrients.fibreG ?? 0) >= 3)
  if (fibre.days <= Math.floor(tracked / 3)) {
    out.push(`Fibre-rich foods (such as dal, vegetables, fruits and whole grains) were recorded less frequently — on ${fibre.days} ${of}.`)
  } else {
    out.push(`Fibre-rich foods such as ${listNames(fibre.names, 3)} were recorded on ${fibre.days} ${of}.`)
  }

  const calcium = foodsMatching(data, days, (food) => (food.nutrients.calciumMg ?? 0) >= 100)
  if (calcium.days >= Math.ceil(tracked * 0.7)) out.push(`Calcium-rich food sources such as ${listNames(calcium.names, 3)} were recorded regularly.`)
  else out.push(`Calcium-rich foods (such as curd, milk, paneer and ragi) were recorded on ${calcium.days} ${of}.`)

  const iron = foodsMatching(data, days, (food) => (food.nutrients.ironMg ?? 0) >= 2)
  if (iron.names.length) out.push(`Iron-rich foods recorded this week: ${listNames(iron.names, 4)}.`)

  const varietyNow = distinctFoods(data.meals.filter((meal) => days.includes(meal.date))).length
  const varietyBefore = distinctFoods(data.meals.filter((meal) => previous.includes(meal.date))).length
  if (varietyBefore) out.push(`${varietyNow} different foods were recorded this week, compared with ${varietyBefore} the week before.`)
  return out
}

export type DayCalories = { kcal: number; partial: boolean; unknown: boolean }

/**
 * Estimated calories eaten on a day, for the history calendar. `null` when nothing is recorded,
 * so an empty day never shows as 0 kcal. A day where every meal was marked not eaten is a
 * recorded 0. `partial` means some foods could not be estimated (shown as "≥"); `unknown` means
 * food was logged but none of it could be estimated.
 */
export function dayCalories(meals: MealEntry[], foods: FoodEntry[], allSkipped: boolean): DayCalories | null {
  if (meals.length === 0) return allSkipped ? { kcal: 0, partial: false, unknown: false } : null
  const total = summarise(meals, foods).totals.energyKcal
  return { kcal: total.value, partial: total.unknown > 0, unknown: total.unknown > 0 && total.value === 0 }
}
