import { mealLabel } from './constants'
import { monthDates, previousMonthDates, previousWeekDates, weekDates } from './dates'
import type {
  JournalData,
  MealConsistency,
  MealEntry,
  MealType,
  QuantityUnit,
} from './types'
import { formatTotalMl, weekWater } from './water'

const MEAL_TYPES: MealType[] = [
  'breakfast',
  'morning-snack',
  'lunch',
  'evening-snack',
  'dinner',
  'mini-snack',
]

export function migrateMealType(type: string): MealType {
  if (type === 'snack') return 'morning-snack'
  if (type === 'drink') return 'mini-snack'
  if (MEAL_TYPES.includes(type as MealType)) return type as MealType
  return 'mini-snack'
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function mealDurationMinutes(entry: Pick<MealEntry, 'time' | 'endTime'>): number | null {
  if (!entry.endTime) return null
  let start = timeToMinutes(entry.time)
  let end = timeToMinutes(entry.endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  if (end < start) end += 24 * 60
  return end - start
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export function formatQuantity(quantity: number, unit: QuantityUnit): string {
  const rounded = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1)
  return `${rounded} ${unit}`
}

export function formatCalories(kcal: number): string {
  const rounded = Number.isInteger(kcal) ? String(kcal) : String(Math.round(kcal * 10) / 10)
  return `${rounded} kcal`
}

export function totalCalories(meals: MealEntry[]): number {
  return meals.reduce((sum, item) => sum + (item.calories ?? 0), 0)
}

export function hasCalories(meals: MealEntry[]): boolean {
  return meals.some((item) => item.calories != null)
}

export function formatConsistency(consistency: MealConsistency, percent: number | null): string {
  if (consistency === 'semi-solid' && percent != null) {
    return `Semi-solid · ${percent}% thick`
  }
  if (consistency === 'solid') return 'Solids'
  if (consistency === 'liquid') return 'Liquids'
  return 'Semi-solid'
}

const ML_PER_UNIT: Record<QuantityUnit, number> = {
  bites: 8,
  spoons: 15,
  pieces: 25,
  bowls: 150,
  cups: 240,
  ml: 1,
}

export function estimatedMl(entry: MealEntry): number | null {
  if (entry.quantity == null || entry.quantity <= 0) return null
  return entry.quantity * ML_PER_UNIT[entry.quantityUnit]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function trendWord(change: number | null): 'up' | 'down' | 'same' | 'unknown' {
  if (change == null) return 'unknown'
  if (change >= 8) return 'up'
  if (change <= -8) return 'down'
  return 'same'
}

export type ReportPeriod = 'week' | 'month'

type PeriodSlice = {
  meals: MealEntry[]
  days: string[]
  totalMeals: number
  daysWithMeals: number
  totalMl: number
  mealsWithQuantity: number
  calorieTotal: number
  mealsWithCalories: number
  avgDuration: number | null
  durations: number[]
  byType: Record<MealType, number>
  byConsistency: Record<MealConsistency, number>
  semiSolidPercents: number[]
  breakfastStarts: number[]
}

function slicePeriod(data: JournalData, days: string[]): PeriodSlice {
  const meals = data.meals.filter((item) => days.includes(item.date))
  const durations = meals
    .map((item) => mealDurationMinutes(item))
    .filter((item): item is number => item != null)
  const mls = meals
    .map((item) => estimatedMl(item))
    .filter((item): item is number => item != null)

  const byType = Object.fromEntries(MEAL_TYPES.map((type) => [type, 0])) as Record<MealType, number>
  const byConsistency: Record<MealConsistency, number> = { solid: 0, 'semi-solid': 0, liquid: 0 }
  const semiSolidPercents: number[] = []
  const breakfastStarts: number[] = []

  for (const meal of meals) {
    byType[meal.type] += 1
    byConsistency[meal.consistency] += 1
    if (meal.consistency === 'semi-solid' && meal.consistencyPercent != null) {
      semiSolidPercents.push(meal.consistencyPercent)
    }
    if (meal.type === 'breakfast') breakfastStarts.push(timeToMinutes(meal.time))
  }

  return {
    meals,
    days,
    totalMeals: meals.length,
    daysWithMeals: new Set(meals.map((item) => item.date)).size,
    totalMl: sum(mls),
    mealsWithQuantity: mls.length,
    calorieTotal: totalCalories(meals),
    mealsWithCalories: meals.filter((item) => item.calories != null).length,
    avgDuration: mean(durations),
    durations,
    byType,
    byConsistency,
    semiSolidPercents,
    breakfastStarts,
  }
}

export type PeriodReport = {
  period: ReportPeriod
  thisPeriod: PeriodSlice
  lastPeriod: PeriodSlice
  quantity: {
    trend: 'up' | 'down' | 'same' | 'unknown'
    change: number | null
    thisTotal: number
    lastTotal: number
    label: string
  }
  calories: {
    trend: 'up' | 'down' | 'same' | 'unknown'
    change: number | null
    thisTotal: number
    lastTotal: number
    label: string
  }
  mealTime: {
    trend: 'up' | 'down' | 'same' | 'unknown'
    change: number | null
    thisAvg: number | null
    lastAvg: number | null
    label: string
  }
  water: {
    trend: 'up' | 'down' | 'same' | 'unknown'
    change: number | null
    thisTotal: number
    lastTotal: number
    count: number
    daysWithWater: number
    label: string
  }
  observations: string[]
}

export type WeeklyReport = PeriodReport

function formatSignedPercent(change: number): string {
  const rounded = Math.abs(change) >= 10 ? Math.round(change) : Math.round(change * 10) / 10
  const value = Math.abs(rounded)
  return `${value}%`
}

export function buildPeriodReport(
  data: JournalData,
  thisDays: string[],
  lastDays: string[],
  period: ReportPeriod,
): PeriodReport {
  const thisPeriod = slicePeriod(data, thisDays)
  const lastPeriod = slicePeriod(data, lastDays)
  const lastLabel = period === 'week' ? 'last week' : 'last month'
  const thisLabel = period === 'week' ? 'this week' : 'this month'
  const nextLabel = period === 'week' ? 'next week' : 'next month'

  const qtyChange = thisPeriod.mealsWithQuantity && lastPeriod.mealsWithQuantity
    ? percentChange(thisPeriod.totalMl, lastPeriod.totalMl)
    : null
  const qtyTrend = trendWord(qtyChange)
  const quantityLabel =
    qtyTrend === 'unknown'
      ? thisPeriod.mealsWithQuantity
        ? `Log quantities for another ${period} to compare intake.`
        : 'Add how much was eaten to track intake.'
      : qtyTrend === 'up'
        ? `Quantity intake increased by about ${formatSignedPercent(qtyChange!)} vs ${lastLabel}.`
        : qtyTrend === 'down'
          ? `Quantity intake decreased by about ${formatSignedPercent(qtyChange!)} vs ${lastLabel}.`
          : `Quantity intake stayed about the same as ${lastLabel}.`

  const calChange = thisPeriod.mealsWithCalories && lastPeriod.mealsWithCalories
    ? percentChange(thisPeriod.calorieTotal, lastPeriod.calorieTotal)
    : null
  const calTrend = trendWord(calChange)
  const caloriesLabel =
    calTrend === 'unknown'
      ? thisPeriod.mealsWithCalories
        ? `Log calories for another ${period} to compare.`
        : 'Add calories on meals to track energy intake.'
      : calTrend === 'up'
        ? `Calories increased by about ${formatSignedPercent(calChange!)} vs ${lastLabel}.`
        : calTrend === 'down'
          ? `Calories decreased by about ${formatSignedPercent(calChange!)} vs ${lastLabel}.`
          : `Calories stayed about the same as ${lastLabel}.`

  const timeChange =
    thisPeriod.avgDuration != null && lastPeriod.avgDuration != null
      ? percentChange(thisPeriod.avgDuration, lastPeriod.avgDuration)
      : null
  const thisWater = weekWater(data, thisDays)
  const lastWater = weekWater(data, lastDays)
  const waterChange = thisWater.count && lastWater.count
    ? percentChange(thisWater.totalMl, lastWater.totalMl)
    : null
  const waterTrend = trendWord(waterChange)
  const waterLabel =
    waterTrend === 'unknown'
      ? thisWater.count
        ? `Log water for another ${period} to compare drinks.`
        : 'Add water logs to track drinks.'
      : waterTrend === 'up'
        ? `Water intake increased by about ${formatSignedPercent(waterChange!)} vs ${lastLabel}.`
        : waterTrend === 'down'
          ? `Water intake decreased by about ${formatSignedPercent(waterChange!)} vs ${lastLabel}.`
          : `Water intake stayed about the same as ${lastLabel}.`

  const timeTrend = trendWord(timeChange)
  const mealTimeLabel =
    timeTrend === 'unknown'
      ? thisPeriod.avgDuration != null
        ? `Meals lasted about ${formatDuration(Math.round(thisPeriod.avgDuration))} on average. Log end times ${nextLabel} to compare.`
        : 'Add meal end times to track how long meals take.'
      : timeTrend === 'up'
        ? `Meal time increased by about ${formatSignedPercent(timeChange!)} vs ${lastLabel}.`
        : timeTrend === 'down'
          ? `Meal time decreased by about ${formatSignedPercent(timeChange!)} vs ${lastLabel}.`
          : `Meal time stayed about the same as ${lastLabel}.`

  const observations: string[] = []

  if (thisPeriod.totalMeals === 0) {
    observations.push(`No meals logged ${thisLabel} yet.`)
  } else {
    observations.push(
      `${thisPeriod.totalMeals} meal${thisPeriod.totalMeals === 1 ? '' : 's'} across ${thisPeriod.daysWithMeals} day${thisPeriod.daysWithMeals === 1 ? '' : 's'}.`,
    )
  }

  const snackCount =
    thisPeriod.byType['morning-snack'] + thisPeriod.byType['evening-snack'] + thisPeriod.byType['mini-snack']
  const lastSnackCount =
    lastPeriod.byType['morning-snack'] + lastPeriod.byType['evening-snack'] + lastPeriod.byType['mini-snack']
  if (thisPeriod.totalMeals && lastPeriod.totalMeals) {
    if (snackCount > lastSnackCount + 1) observations.push(`More snacks than ${lastLabel}.`)
    if (snackCount < lastSnackCount - 1) observations.push(`Fewer snacks than ${lastLabel}.`)
  }

  if (thisPeriod.daysWithMeals >= 3 && thisPeriod.byType.breakfast < thisPeriod.daysWithMeals) {
    observations.push('Some days had no breakfast logged.')
  } else if (thisPeriod.daysWithMeals >= 4 && thisPeriod.byType.breakfast >= thisPeriod.daysWithMeals - 1) {
    observations.push('Breakfast was logged most days.')
  }

  const solids = thisPeriod.byConsistency.solid
  const liquids = thisPeriod.byConsistency.liquid
  const semi = thisPeriod.byConsistency['semi-solid']
  if (solids + liquids + semi >= 3) {
    if (liquids > solids && liquids > semi) observations.push('Liquids made up more of the meals than solids.')
    else if (solids > liquids + semi) observations.push(`Most meals ${thisLabel} were solids.`)
    else if (semi >= solids && semi >= liquids) observations.push(`Semi-solids showed up often ${thisLabel}.`)
  }

  const avgThick = mean(thisPeriod.semiSolidPercents)
  if (avgThick != null) {
    observations.push(`Semi-solids averaged about ${Math.round(avgThick)}% thick.`)
  }

  if (thisPeriod.avgDuration != null) {
    if (thisPeriod.avgDuration >= 35) observations.push('Meals ran long on average (over 35 minutes).')
    else if (thisPeriod.avgDuration <= 12) observations.push(`Meals were fairly quick ${thisLabel}.`)
  }

  const longestType = MEAL_TYPES
    .map((type) => {
      const mins = thisPeriod.meals
        .filter((item) => item.type === type)
        .map((item) => mealDurationMinutes(item))
        .filter((item): item is number => item != null)
      return { type, avg: mean(mins), count: mins.length }
    })
    .filter((item) => item.count >= 2)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0]
  if (longestType?.avg) {
    observations.push(`${mealLabel(longestType.type)} took the longest, about ${formatDuration(Math.round(longestType.avg))}.`)
  }

  const avgBreakfast = mean(thisPeriod.breakfastStarts)
  const lastBreakfast = mean(lastPeriod.breakfastStarts)
  if (avgBreakfast != null && lastBreakfast != null) {
    const diff = avgBreakfast - lastBreakfast
    if (diff >= 20) observations.push(`Breakfast started later than ${lastLabel}.`)
    if (diff <= -20) observations.push(`Breakfast started earlier than ${lastLabel}.`)
  }

  if (thisWater.count === 0) {
    observations.push(`No water logged ${thisLabel} yet.`)
  } else {
    observations.push(
      `${thisWater.count} drink${thisWater.count === 1 ? '' : 's'} totaling ${formatTotalMl(thisWater.totalMl)} across ${thisWater.daysWithWater} day${thisWater.daysWithWater === 1 ? '' : 's'}.`,
    )
  }

  const periodPoops = data.poops.filter((item) => thisDays.includes(item.date))
  const loose = periodPoops.filter((item) => item.bristol >= 6).length
  if (loose >= 2 && liquids > solids) {
    observations.push(`Looser stools showed up in a ${period} with more liquids.`)
  }
  const hard = periodPoops.filter((item) => item.bristol <= 2).length
  if (hard >= 2 && solids > liquids) {
    observations.push(`Harder stools showed up in a ${period} with more solids.`)
  }
  if (hard >= 2 && thisWater.count > 0 && thisWater.daysWithWater <= Math.max(1, Math.floor(thisDays.length / 2))) {
    observations.push(`Harder stools showed up in a ${period} with little water logged.`)
  }

  const periodMoods = data.moods.filter((item) => thisDays.includes(item.date))
  const fussy = periodMoods.filter((item) => item.mood === 'fussy' || item.mood === 'irritable' || item.mood === 'tummy').length
  if (fussy >= 3 && thisPeriod.avgDuration != null && thisPeriod.avgDuration >= 30) {
    observations.push('Fussy or tummy-ache moods showed up alongside longer meals.')
  }

  return {
    period,
    thisPeriod,
    lastPeriod,
    quantity: {
      trend: qtyTrend,
      change: qtyChange,
      thisTotal: thisPeriod.totalMl,
      lastTotal: lastPeriod.totalMl,
      label: quantityLabel,
    },
    calories: {
      trend: calTrend,
      change: calChange,
      thisTotal: thisPeriod.calorieTotal,
      lastTotal: lastPeriod.calorieTotal,
      label: caloriesLabel,
    },
    mealTime: {
      trend: timeTrend,
      change: timeChange,
      thisAvg: thisPeriod.avgDuration,
      lastAvg: lastPeriod.avgDuration,
      label: mealTimeLabel,
    },
    water: {
      trend: waterTrend,
      change: waterChange,
      thisTotal: thisWater.totalMl,
      lastTotal: lastWater.totalMl,
      count: thisWater.count,
      daysWithWater: thisWater.daysWithWater,
      label: waterLabel,
    },
    observations,
  }
}

export function buildWeeklyReport(data: JournalData, endISO: string): PeriodReport {
  const thisDays = weekDates(endISO)
  return buildPeriodReport(data, thisDays, previousWeekDates(thisDays), 'week')
}

export function buildMonthlyReport(data: JournalData, endISO: string): PeriodReport {
  const thisDays = monthDates(endISO)
  return buildPeriodReport(data, thisDays, previousMonthDates(thisDays), 'month')
}
