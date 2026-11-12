import { mealLabel } from './constants'
import { shiftDate, weekDates } from './dates'
import type {
  JournalData,
  MealConsistency,
  MealEntry,
  MealType,
  QuantityUnit,
} from './types'

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

type WeekSlice = {
  meals: MealEntry[]
  days: string[]
  totalMeals: number
  daysWithMeals: number
  totalMl: number
  mealsWithQuantity: number
  avgDuration: number | null
  durations: number[]
  byType: Record<MealType, number>
  byConsistency: Record<MealConsistency, number>
  semiSolidPercents: number[]
  breakfastStarts: number[]
}

function sliceWeek(data: JournalData, days: string[]): WeekSlice {
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
    avgDuration: mean(durations),
    durations,
    byType,
    byConsistency,
    semiSolidPercents,
    breakfastStarts,
  }
}

export type WeeklyReport = {
  thisWeek: WeekSlice
  lastWeek: WeekSlice
  quantity: {
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
  observations: string[]
}

function formatSignedPercent(change: number): string {
  const rounded = Math.abs(change) >= 10 ? Math.round(change) : Math.round(change * 10) / 10
  const value = Math.abs(rounded)
  return `${value}%`
}

export function buildWeeklyReport(data: JournalData, endISO: string): WeeklyReport {
  const thisDays = weekDates(endISO)
  const lastDays = weekDates(shiftDate(endISO, -7))
  const thisWeek = sliceWeek(data, thisDays)
  const lastWeek = sliceWeek(data, lastDays)

  const qtyChange = thisWeek.mealsWithQuantity && lastWeek.mealsWithQuantity
    ? percentChange(thisWeek.totalMl, lastWeek.totalMl)
    : null
  const qtyTrend = trendWord(qtyChange)
  const quantityLabel =
    qtyTrend === 'unknown'
      ? thisWeek.mealsWithQuantity
        ? 'Log quantities for another week to compare intake.'
        : 'Add how much he ate to track intake.'
      : qtyTrend === 'up'
        ? `Quantity intake increased by about ${formatSignedPercent(qtyChange!)} vs last week.`
        : qtyTrend === 'down'
          ? `Quantity intake decreased by about ${formatSignedPercent(qtyChange!)} vs last week.`
          : 'Quantity intake stayed about the same as last week.'

  const timeChange =
    thisWeek.avgDuration != null && lastWeek.avgDuration != null
      ? percentChange(thisWeek.avgDuration, lastWeek.avgDuration)
      : null
  const timeTrend = trendWord(timeChange)
  const mealTimeLabel =
    timeTrend === 'unknown'
      ? thisWeek.avgDuration != null
        ? `Meals lasted about ${formatDuration(Math.round(thisWeek.avgDuration))} on average. Log end times next week to compare.`
        : 'Add meal end times to track how long he takes to eat.'
      : timeTrend === 'up'
        ? `Meal time increased by about ${formatSignedPercent(timeChange!)} vs last week.`
        : timeTrend === 'down'
          ? `Meal time decreased by about ${formatSignedPercent(timeChange!)} vs last week.`
          : 'Meal time stayed about the same as last week.'

  const observations: string[] = []

  if (thisWeek.totalMeals === 0) {
    observations.push('No meals logged this week yet.')
  } else {
    observations.push(
      `${thisWeek.totalMeals} meal${thisWeek.totalMeals === 1 ? '' : 's'} across ${thisWeek.daysWithMeals} day${thisWeek.daysWithMeals === 1 ? '' : 's'}.`,
    )
  }

  const snackCount =
    thisWeek.byType['morning-snack'] + thisWeek.byType['evening-snack'] + thisWeek.byType['mini-snack']
  const lastSnackCount =
    lastWeek.byType['morning-snack'] + lastWeek.byType['evening-snack'] + lastWeek.byType['mini-snack']
  if (thisWeek.totalMeals && lastWeek.totalMeals) {
    if (snackCount > lastSnackCount + 1) observations.push('He had more snacks than last week.')
    if (snackCount < lastSnackCount - 1) observations.push('He had fewer snacks than last week.')
  }

  if (thisWeek.daysWithMeals >= 3 && thisWeek.byType.breakfast < thisWeek.daysWithMeals) {
    observations.push('Some days had no breakfast logged.')
  } else if (thisWeek.daysWithMeals >= 4 && thisWeek.byType.breakfast >= thisWeek.daysWithMeals - 1) {
    observations.push('Breakfast was logged most days.')
  }

  const solids = thisWeek.byConsistency.solid
  const liquids = thisWeek.byConsistency.liquid
  const semi = thisWeek.byConsistency['semi-solid']
  if (solids + liquids + semi >= 3) {
    if (liquids > solids && liquids > semi) observations.push('Liquids made up more of his meals than solids.')
    else if (solids > liquids + semi) observations.push('Most meals this week were solids.')
    else if (semi >= solids && semi >= liquids) observations.push('Semi-solids showed up often this week.')
  }

  const avgThick = mean(thisWeek.semiSolidPercents)
  if (avgThick != null) {
    observations.push(`Semi-solids averaged about ${Math.round(avgThick)}% thick.`)
  }

  if (thisWeek.avgDuration != null) {
    if (thisWeek.avgDuration >= 35) observations.push('Meals ran long on average (over 35 minutes).')
    else if (thisWeek.avgDuration <= 12) observations.push('Meals were fairly quick this week.')
  }

  const longestType = MEAL_TYPES
    .map((type) => {
      const mins = thisWeek.meals
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

  const avgBreakfast = mean(thisWeek.breakfastStarts)
  const lastBreakfast = mean(lastWeek.breakfastStarts)
  if (avgBreakfast != null && lastBreakfast != null) {
    const diff = avgBreakfast - lastBreakfast
    if (diff >= 20) observations.push('Breakfast started later than last week.')
    if (diff <= -20) observations.push('Breakfast started earlier than last week.')
  }

  const weekPoops = data.poops.filter((item) => thisDays.includes(item.date))
  const loose = weekPoops.filter((item) => item.bristol >= 6).length
  if (loose >= 2 && liquids > solids) {
    observations.push('Looser stools showed up in a week with more liquids.')
  }
  const hard = weekPoops.filter((item) => item.bristol <= 2).length
  if (hard >= 2 && solids > liquids) {
    observations.push('Harder stools showed up in a week with more solids.')
  }

  const weekMoods = data.moods.filter((item) => thisDays.includes(item.date))
  const fussy = weekMoods.filter((item) => item.mood === 'fussy' || item.mood === 'irritable' || item.mood === 'tummy').length
  if (fussy >= 3 && thisWeek.avgDuration != null && thisWeek.avgDuration >= 30) {
    observations.push('Fussy or tummy-ache moods showed up alongside longer meals.')
  }

  return {
    thisWeek,
    lastWeek,
    quantity: {
      trend: qtyTrend,
      change: qtyChange,
      thisTotal: thisWeek.totalMl,
      lastTotal: lastWeek.totalMl,
      label: quantityLabel,
    },
    mealTime: {
      trend: timeTrend,
      change: timeChange,
      thisAvg: thisWeek.avgDuration,
      lastAvg: lastWeek.avgDuration,
      label: mealTimeLabel,
    },
    observations,
  }
}
