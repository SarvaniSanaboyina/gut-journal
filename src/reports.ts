import { dateRange, shiftDate } from './dates'
import { consumedPercent, eatenFoods, FOOD_GROUPS } from './foods'
import { BRISTOL_GROUPS, findAssociations, gutStats, symptomLabel, type Association, type BristolGroup } from './gut'
import { averageTotals, NUTRIENTS, type NutrientTotals } from './nutrition'
import type { FoodGroup, JournalData, NutrientKey } from './types'
import { totalWaterMl } from './water'

/**
 * Period summaries for reports: one pass over a set of days, plus a comparison with the
 * period of the same length immediately before it. Every figure is descriptive — changes are
 * reported as "more"/"fewer", never as better or worse.
 */

export type ReportRange = { start: string; end: string }

export function rangeDays(range: ReportRange) {
  return dateRange(range.start, range.end)
}

/** The same number of days immediately before the range. */
export function previousRange(range: ReportRange): ReportRange {
  const length = rangeDays(range).length
  return { start: shiftDate(range.start, -length), end: shiftDate(range.start, -1) }
}

export type PeriodSummary = {
  range: ReportRange
  days: string[]
  trackedDays: number
  eating: {
    meals: number
    mealDays: number
    mealsPerDay: number | null
    /** Average share of what was served that was eaten, across items where it was recorded. */
    averageEatenPercent: number | null
    itemsWithAmount: number
    items: number
    refused: number
    refusedFoods: { name: string; count: number }[]
    distinctFoods: number
    newFoods: string[]
    mostEaten: { name: string; count: number }[]
    waterMl: number
    waterDays: number
  }
  nutrition: {
    loggedDays: number
    groupDays: Record<FoodGroup, number>
    average: NutrientTotals
  }
  gut: {
    bowelMovements: number
    perTrackedDay: number | null
    daysWithout: number
    longestGap: number
    byGroup: Record<BristolGroup, number>
    strainOrPain: number
    blood: number
    mucus: number
    symptoms: number
    symptomDays: number
    symptomTypes: { name: string; count: number; severe: number }[]
  }
  checkIns: {
    days: number
    averageSleep: number | null
    lowAppetiteDays: number
    lowEnergyDays: number
  }
  reactions: {
    parentLinked: { food: string; symptom: string; count: number }[]
    associations: Association[]
  }
}

function top<T extends string>(counts: Map<T, number>, limit = 5) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

export function summarisePeriod(data: JournalData, range: ReportRange): PeriodSummary {
  const days = rangeDays(range)
  const set = new Set(days)
  const meals = data.meals.filter((meal) => set.has(meal.date))
  const gut = gutStats(data, days)

  // Eating habits
  let items = 0
  let itemsWithAmount = 0
  let eatenTotal = 0
  let refused = 0
  const refusedFoods = new Map<string, number>()
  const eaten = new Map<string, number>()
  const seenKeys = new Set<string>()
  for (const meal of meals) {
    for (const item of meal.items) {
      items += 1
      const percent = consumedPercent(item)
      if (percent != null) {
        itemsWithAmount += 1
        eatenTotal += percent
        if (percent === 0) {
          refused += 1
          refusedFoods.set(item.name, (refusedFoods.get(item.name) ?? 0) + 1)
        }
      }
    }
    for (const food of eatenFoods(meal)) {
      if (food.parent) continue
      seenKeys.add(food.key)
      eaten.set(food.name, (eaten.get(food.name) ?? 0) + 1)
    }
  }
  const earlierKeys = new Set(
    data.meals.filter((meal) => meal.date < range.start).flatMap((meal) => eatenFoods(meal).map((food) => food.key)),
  )
  const newFoods = new Map<string, string>()
  for (const meal of meals) {
    for (const food of eatenFoods(meal)) {
      if (!food.parent && !earlierKeys.has(food.key)) newFoods.set(food.key, food.name)
    }
  }
  const hasHistoryBefore = data.meals.some((meal) => meal.date < range.start)
  const mealDays = new Set(meals.map((meal) => meal.date)).size
  const waters = data.waters.filter((item) => set.has(item.date))

  // Nutrition
  const nutrition = averageTotals(data, days)
  const groupDays = Object.fromEntries(FOOD_GROUPS.map((group) => [group.id, 0])) as Record<FoodGroup, number>
  const foodsById = new Map(data.foods.map((food) => [food.id, food]))
  for (const day of new Set(meals.map((meal) => meal.date))) {
    const groups = new Set<FoodGroup>()
    for (const meal of meals.filter((item) => item.date === day)) {
      for (const food of eatenFoods(meal)) {
        for (const group of foodsById.get(food.foodId ?? '')?.groups ?? []) groups.add(group)
      }
    }
    for (const group of groups) groupDays[group] += 1
  }

  // Symptoms
  const symptomCounts = new Map<string, { count: number; severe: number }>()
  for (const symptom of gut.symptoms) {
    const name = symptomLabel(symptom)
    const entry = symptomCounts.get(name) ?? { count: 0, severe: 0 }
    entry.count += 1
    if (symptom.severity === 'severe') entry.severe += 1
    symptomCounts.set(name, entry)
  }

  // Daily check-ins
  const metrics = data.dailyMetrics.filter((item) => set.has(item.date))
  const sleeps = metrics.map((item) => item.sleepHours).filter((value): value is number => value != null)

  // Food reactions the parent linked, and repeated food → symptom sequences
  const linked = new Map<string, { food: string; symptom: string; count: number }>()
  for (const symptom of gut.symptoms) {
    for (const reaction of symptom.reactions) {
      const key = `${reaction.foodName.toLowerCase()}|${symptomLabel(symptom)}`
      const entry = linked.get(key) ?? { food: reaction.foodName, symptom: symptomLabel(symptom), count: 0 }
      entry.count += 1
      linked.set(key, entry)
    }
  }

  return {
    range,
    days,
    trackedDays: gut.trackedDays.length,
    eating: {
      meals: meals.length,
      mealDays,
      mealsPerDay: mealDays ? meals.length / mealDays : null,
      averageEatenPercent: itemsWithAmount ? eatenTotal / itemsWithAmount : null,
      itemsWithAmount,
      items,
      refused,
      refusedFoods: top(refusedFoods, 4),
      distinctFoods: seenKeys.size,
      newFoods: hasHistoryBefore ? [...newFoods.values()] : [],
      mostEaten: top(eaten, 6),
      waterMl: totalWaterMl(waters),
      waterDays: new Set(waters.map((item) => item.date)).size,
    },
    nutrition: { loggedDays: nutrition.loggedDays, groupDays, average: nutrition.average },
    gut: {
      bowelMovements: gut.poops.length,
      perTrackedDay: gut.trackedDays.length ? gut.perDay : null,
      daysWithout: gut.daysWithout,
      longestGap: gut.longestGap,
      byGroup: gut.byGroup,
      strainOrPain: gut.strainOrPain,
      blood: gut.poops.filter((item) => item.visibleBlood || item.color === 'red' || item.color === 'black').length,
      mucus: gut.poops.filter((item) => item.mucus).length,
      symptoms: gut.symptoms.length,
      symptomDays: new Set(gut.symptoms.map((item) => item.date)).size,
      symptomTypes: [...symptomCounts.entries()]
        .map(([name, value]) => ({ name, ...value }))
        .sort((a, b) => b.count - a.count),
    },
    checkIns: {
      days: metrics.length,
      averageSleep: sleeps.length ? sleeps.reduce((sum, value) => sum + value, 0) / sleeps.length : null,
      lowAppetiteDays: metrics.filter((item) => item.appetite === 'low').length,
      lowEnergyDays: metrics.filter((item) => item.energy === 'low').length,
    },
    reactions: {
      parentLinked: [...linked.values()].sort((a, b) => b.count - a.count),
      associations: findAssociations(data, set, 24).slice(0, 5),
    },
  }
}

// ---------------------------------------------------------------------------
// Comparison rows

export type CompareRow = {
  key: string
  label: string
  current: string
  previous: string
  /** Neutral description of the change, or '' when either side has no data. */
  change: string
  direction: 'up' | 'down' | 'same' | 'none'
}

function fmt(value: number | null, digits = 1, suffix = '') {
  if (value == null) return '—'
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits
  return `${rounded}${suffix}`
}

function row(
  key: string,
  label: string,
  current: number | null,
  previous: number | null,
  options: { digits?: number; suffix?: string; tolerance?: number } = {},
): CompareRow {
  const { digits = 1, suffix = '', tolerance = 0.05 } = options
  let change = ''
  let direction: CompareRow['direction'] = 'none'
  if (current != null && previous != null) {
    const diff = current - previous
    const scale = Math.max(Math.abs(previous), Math.abs(current), 1e-9)
    if (Math.abs(diff) / scale <= tolerance) {
      direction = 'same'
      change = 'About the same'
    } else {
      direction = diff > 0 ? 'up' : 'down'
      change = `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff), digits, suffix)}`
    }
  }
  return { key, label, current: fmt(current, digits, suffix), previous: fmt(previous, digits, suffix), change, direction }
}

const REPORT_NUTRIENTS: NutrientKey[] = ['energyKcal', 'proteinG', 'fibreG', 'ironMg', 'calciumMg']

export function comparisonSections(current: PeriodSummary, previous: PeriodSummary) {
  const prevHas = { meals: previous.eating.meals > 0, tracked: previous.trackedDays > 0, checkIns: previous.checkIns.days > 0 }
  const curHas = { meals: current.eating.meals > 0, tracked: current.trackedDays > 0, checkIns: current.checkIns.days > 0 }
  const pick = <T,>(has: boolean, value: T | null) => (has ? value : null)
  const share = (summary: PeriodSummary, group: BristolGroup) =>
    summary.gut.bowelMovements ? (summary.gut.byGroup[group] / summary.gut.bowelMovements) * 100 : null

  const eating: CompareRow[] = [
    row('days', 'Days with meals logged', current.eating.mealDays, previous.eating.mealDays, { digits: 0 }),
    row('mpd', 'Meals per logged day', pick(curHas.meals, current.eating.mealsPerDay), pick(prevHas.meals, previous.eating.mealsPerDay)),
    row('eaten', 'Share of served food eaten', current.eating.averageEatenPercent, previous.eating.averageEatenPercent, { digits: 0, suffix: '%' }),
    row('refused', 'Foods refused', pick(curHas.meals, current.eating.refused), pick(prevHas.meals, previous.eating.refused), { digits: 0 }),
    row('variety', 'Different foods eaten', pick(curHas.meals, current.eating.distinctFoods), pick(prevHas.meals, previous.eating.distinctFoods), { digits: 0 }),
  ]

  const nutrition: CompareRow[] = [
    ...FOOD_GROUPS.map((group) =>
      row(
        `group-${group.id}`,
        `${group.label}: days recorded`,
        pick(curHas.meals, current.nutrition.groupDays[group.id]),
        pick(prevHas.meals, previous.nutrition.groupDays[group.id]),
        { digits: 0 },
      ),
    ),
    ...REPORT_NUTRIENTS.map((key) => {
      const meta = NUTRIENTS[key]
      return row(
        `n-${key}`,
        `${meta.label} per day (est.)`,
        pick(curHas.meals, current.nutrition.average[key].value),
        pick(prevHas.meals, previous.nutrition.average[key].value),
        { digits: meta.digits, suffix: ` ${meta.unit}`, tolerance: 0.1 },
      )
    }),
  ]

  const gut: CompareRow[] = [
    row('bm', 'Bowel movements', pick(curHas.tracked, current.gut.bowelMovements), pick(prevHas.tracked, previous.gut.bowelMovements), { digits: 0 }),
    row('bmpd', 'Per tracked day', current.gut.perTrackedDay, previous.gut.perTrackedDay),
    row('gap', 'Longest run without one (days)', pick(curHas.tracked, current.gut.longestGap), pick(prevHas.tracked, previous.gut.longestGap), { digits: 0 }),
    ...BRISTOL_GROUPS.map((group) =>
      row(`bg-${group.id}`, `${group.label} (${group.range})`, share(current, group.id), share(previous, group.id), { digits: 0, suffix: '%', tolerance: 0.15 }),
    ),
    row('strain', 'With straining or pain', pick(curHas.tracked, current.gut.strainOrPain), pick(prevHas.tracked, previous.gut.strainOrPain), { digits: 0 }),
    row('sym', 'Symptoms recorded', pick(curHas.tracked, current.gut.symptoms), pick(prevHas.tracked, previous.gut.symptoms), { digits: 0 }),
    row('symdays', 'Days with symptoms', pick(curHas.tracked, current.gut.symptomDays), pick(prevHas.tracked, previous.gut.symptomDays), { digits: 0 }),
  ]

  const wellbeing: CompareRow[] = [
    row('sleep', 'Average sleep', current.checkIns.averageSleep, previous.checkIns.averageSleep, { suffix: ' h' }),
    row('appetite', 'Low-appetite days', pick(curHas.checkIns, current.checkIns.lowAppetiteDays), pick(prevHas.checkIns, previous.checkIns.lowAppetiteDays), { digits: 0 }),
    row('energy', 'Low-energy days', pick(curHas.checkIns, current.checkIns.lowEnergyDays), pick(prevHas.checkIns, previous.checkIns.lowEnergyDays), { digits: 0 }),
  ]

  return { eating, nutrition, gut, wellbeing }
}

/** Short plain-language highlights; descriptive only. */
export function reportHighlights(current: PeriodSummary, previous: PeriodSummary): string[] {
  const out: string[] = []
  if (current.trackedDays === 0) return ['Nothing was logged in this period.']
  const { eating, gut } = current
  if (eating.mealDays) {
    out.push(`Meals were logged on ${eating.mealDays} of ${current.days.length} days, ${eating.distinctFoods} different food${eating.distinctFoods === 1 ? '' : 's'}.`)
  }
  if (eating.newFoods.length) {
    const names = eating.newFoods.slice(0, 5).join(', ')
    out.push(`New food${eating.newFoods.length === 1 ? '' : 's'} tried: ${names}${eating.newFoods.length > 5 ? ` and ${eating.newFoods.length - 5} more` : ''}.`)
  }
  if (eating.refusedFoods.length) {
    out.push(`Most often refused: ${eating.refusedFoods.map((item) => `${item.name} (${item.count})`).join(', ')}.`)
  }
  if (gut.bowelMovements) {
    const formed = gut.byGroup.formed
    out.push(`${gut.bowelMovements} bowel movement${gut.bowelMovements === 1 ? '' : 's'} over ${current.trackedDays} tracked day${current.trackedDays === 1 ? '' : 's'}; ${formed} were type 3–4.`)
  }
  if (gut.symptomTypes.length) {
    out.push(`Symptoms: ${gut.symptomTypes.map((item) => `${item.name.toLowerCase()} ×${item.count}`).join(', ')}.`)
  } else if (current.trackedDays) {
    out.push('No symptoms were recorded.')
  }
  if (previous.trackedDays && previous.gut.symptoms && gut.symptoms !== previous.gut.symptoms) {
    out.push(`${gut.symptoms > previous.gut.symptoms ? 'More' : 'Fewer'} symptoms than the previous period (${gut.symptoms} vs ${previous.gut.symptoms}).`)
  }
  return out
}
