import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { foodMap } from '../src/foods.ts'
import {
  bowelIndicator,
  buildDayIndex,
  dayCompletion,
  dayConsumption,
  daySlots,
  dayWaterMl,
  dayRecords,
  slotPercent,
  summariseDay,
} from '../src/mealSlots.ts'
import { emptyJournal, type FoodEntry, type JournalData, type MealEntry, type MealItem, type SlotType, type WaterEntry } from '../src/types.ts'

const DATE = '2026-11-18'

function food(id: string, unitGrams: FoodEntry['unitGrams'] = {}): FoodEntry {
  return {
    id, name: id, aliases: [], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'pieces', defaultQty: 1,
    unitGrams, nutrients: {} as FoodEntry['nutrients'], nutrientSource: 'none', sourceNote: '', ingredients: [], isCustom: false,
  }
}

const FOODS = [food('idli', { pieces: 40 }), food('rice', { bowls: 150 }), food('laddoo')]
const FOOD_MAP = foodMap(FOODS)

function item(foodId: string | null, served: number | null, eaten: number | null, unit: MealItem['unit'] = 'pieces', percent: number | null = null): MealItem {
  return { id: `${foodId}-${Math.random()}`, foodId, name: foodId ?? 'x', quantityServed: served, quantityConsumed: eaten, unit, consumedPercent: percent, preparation: '', notes: '', ingredients: [] }
}

function meal(type: MealEntry['type'], items: MealItem[], date = DATE): MealEntry {
  return {
    id: `${type}-${Math.random()}`, date, time: '12:00', endTime: '', type, foods: '', quantity: null, quantityUnit: 'spoons',
    consistency: 'solid', consistencyPercent: null, calories: null, notes: '', hasBeforePhoto: false, hasAfterPhoto: false, source: '', items,
  }
}

function journal(parts: Partial<JournalData>): JournalData {
  return { ...emptyJournal(), foods: FOODS, ...parts }
}

function skip(mealType: SlotType, date = DATE) {
  return { date, mealType, status: 'not-eaten' as const, note: '' }
}

function water(amount: number, unit: WaterEntry['unit'] = 'ml', date = DATE): WaterEntry {
  return { id: `w-${Math.random()}`, date, time: '10:00', amount, unit, notes: '' }
}

function summary(data: JournalData, date = DATE) {
  return summariseDay(buildDayIndex(data), date, foodMap(data.foods))
}

const allFive = (items: () => MealItem[]) =>
  (['breakfast', 'morning-snack', 'lunch', 'evening-snack', 'dinner'] as const).map((type) => meal(type, items()))

describe('daily completion', () => {
  it('is Not logged with no entries, and never auto-marks Not eaten', () => {
    const day = summary(journal({}))
    assert.equal(day.completion.status, 'not-logged')
    assert.deepEqual([day.completion.eaten, day.completion.skipped, day.completion.notLogged], [0, 0, 5])
    assert.ok(day.slots.every((slot) => slot.status === 'not-logged'))
  })

  it('is Incomplete while any slot is Not logged', () => {
    const day = summary(journal({ meals: [meal('breakfast', [item('idli', 2, 2)])], mealSlots: [skip('lunch')] }))
    assert.equal(day.completion.status, 'incomplete')
    assert.deepEqual([day.completion.eaten, day.completion.skipped, day.completion.notLogged], [1, 1, 3])
  })

  it('is Complete when every slot is Eaten or Not eaten, even with skips', () => {
    const meals = [meal('breakfast', [item('idli', 2, 2)]), meal('lunch', [item('rice', 1, 1, 'bowls')]), meal('dinner', [item('rice', 1, 1, 'bowls')])]
    const day = summary(journal({ meals, mealSlots: [skip('morning-snack'), skip('evening-snack')] }))
    assert.equal(day.completion.status, 'complete')
    assert.equal(day.completion.skipped, 2)
  })

  it('ignores "Other" meals for the schedule', () => {
    const day = summary(journal({ meals: [meal('mini-snack', [item('idli', 1, 1)])] }))
    assert.equal(day.completion.status, 'not-logged')
  })

  it('treats a logged meal as Eaten even if a stale Not eaten mark exists', () => {
    const slots = daySlots(dayRecords(buildDayIndex(journal({ meals: [meal('lunch', [item('idli', 1, 1)])], mealSlots: [skip('lunch')] })), DATE), FOOD_MAP)
    assert.equal(slots.find((slot) => slot.slot.id === 'lunch')!.status, 'eaten')
  })
})

describe('consumption calculation', () => {
  it('weights items by grams when every served amount converts', () => {
    // 2 idli (80 g) all eaten + 1 bowl rice (150 g) half eaten → (80 + 75) / 230
    const percent = slotPercent([meal('lunch', [item('idli', 2, 2), item('rice', 1, 0.5, 'bowls')])], FOOD_MAP)
    assert.ok(Math.abs(percent! - (155 / 230) * 100) < 1e-9)
  })

  it('falls back to equal portions when a weight is unknown', () => {
    // laddoo has no piece weight: average of 100 % and 0 %
    const percent = slotPercent([meal('lunch', [item('idli', 2, 2), item('laddoo', 1, 0)])], FOOD_MAP)
    assert.equal(percent, 50)
  })

  it('is unknown when an eaten amount was not recorded', () => {
    assert.equal(slotPercent([meal('lunch', [item('idli', 2, null)])], FOOD_MAP), null)
    assert.equal(slotPercent([meal('lunch', [])], FOOD_MAP), null)
  })

  it('shows Not logged (no percentage) while any slot is missing', () => {
    const meals = allFive(() => [item('idli', 2, 2)]).slice(0, 4)
    assert.deepEqual(summary(journal({ meals })).consumption, { state: 'not-logged', percent: null })
  })

  it('classifies enough / less / more with the default thresholds', () => {
    assert.equal(summary(journal({ meals: allFive(() => [item('idli', 2, 2)]) })).consumption.state, 'enough')
    assert.equal(summary(journal({ meals: allFive(() => [item('idli', 4, 1)]) })).consumption.state, 'less')
    assert.equal(summary(journal({ meals: allFive(() => [item('idli', 2, 3)]) })).consumption.state, 'more')
  })

  it('counts a Not eaten slot as 0 % of that slot', () => {
    const meals = allFive(() => [item('idli', 2, 2)]).slice(0, 4)
    const day = summary(journal({ meals, mealSlots: [skip('dinner')] }))
    assert.deepEqual(day.consumption, { state: 'enough', percent: 80 })
    const twoSkipped = summary(journal({ meals: meals.slice(0, 2), mealSlots: [skip('lunch'), skip('evening-snack'), skip('dinner')] }))
    assert.equal(twoSkipped.consumption.state, 'less')
    assert.equal(twoSkipped.consumption.percent, 40)
  })

  it('has a separate state when all five are Not eaten', () => {
    const mealSlots = (['breakfast', 'morning-snack', 'lunch', 'evening-snack', 'dinner'] as const).map((type) => skip(type))
    assert.equal(summary(journal({ mealSlots })).consumption.state, 'all-skipped')
  })

  it('uses configurable thresholds', () => {
    const data = journal({ meals: allFive(() => [item('idli', 4, 3)]) })
    assert.equal(summary(data).consumption.state, 'enough')
    const day = summariseDay(buildDayIndex(data), DATE, foodMap(data.foods), { lessBelow: 80, moreAbove: 120 })
    assert.equal(day.consumption.state, 'less')
  })

  it('does not classify a complete day with unrecorded amounts', () => {
    const meals = allFive(() => [item('idli', 2, 2)])
    meals[2] = meal('lunch', [item('idli', 2, null)])
    assert.equal(summary(journal({ meals })).consumption.state, 'unknown')
  })

  it('uses completion and consumption from the same slots', () => {
    const slots = daySlots(dayRecords(buildDayIndex(journal({})), DATE), FOOD_MAP)
    assert.equal(dayCompletion(slots).status, 'not-logged')
    assert.equal(dayConsumption(slots).state, 'not-logged')
  })
})

describe('water totals', () => {
  it('is null (shown as a dash) when nothing is recorded', () => {
    assert.equal(dayWaterMl([]), null)
    assert.equal(summary(journal({})).waterMl, null)
  })

  it('is 0 only for an explicit 0 ml entry', () => {
    assert.equal(summary(journal({ waters: [water(0)] })).waterMl, 0)
  })

  it('sums several entries, converting units, per local date', () => {
    const waters = [water(150), water(100), water(2, 'sips'), water(500, 'ml', '2026-11-17')]
    assert.equal(summary(journal({ waters })).waterMl, 280)
    assert.equal(summary(journal({ waters }), '2026-11-17').waterMl, 500)
  })
})

describe('bowel movement indicator', () => {
  const poop = (date: string) => ({
    id: `p-${Math.random()}`, date, time: '09:00', bristol: 4 as const, color: 'brown' as const, amount: 'medium' as const,
    straining: false, pain: false, mucus: false, visibleBlood: false, hasPhoto: false, notes: '', consistency: 'soft',
  })

  it('shows no dot without a bowel movement', () => {
    assert.deepEqual(bowelIndicator([]), { count: 0, show: false })
  })

  it('shows one dot for one or many, and counts them', () => {
    const data = journal({ poops: [poop(DATE), poop(DATE), poop('2026-11-17')] as unknown as JournalData['poops'] })
    assert.equal(summary(data).bowelMovements, 2)
    assert.deepEqual(bowelIndicator(dayRecords(buildDayIndex(data), DATE).poops), { count: 2, show: true })
    assert.equal(summary(data, '2026-11-16').bowelMovements, 0)
  })
})

describe('period reports', async () => {
  const { summarisePeriod } = await import('../src/reports.ts')
  const range = { start: '2026-11-16', end: '2026-11-18' }

  it('counts complete, incomplete and unlogged days without treating gaps as zero', () => {
    const data = journal({
      meals: [...allFive(() => [item('idli', 2, 2)]), meal('lunch', [item('idli', 2, 1)], '2026-11-17')],
      mealSlots: [skip('dinner', '2026-11-17')],
      waters: [water(200), water(150), water(0, 'ml', '2026-11-17')],
    })
    const report = summarisePeriod(data, range)
    assert.deepEqual(
      [report.schedule.completeDays, report.schedule.incompleteDays, report.schedule.noLogDays],
      [1, 1, 1],
    )
    // Averages over the 2 recorded days only: (5 + 1) / 2 eaten, (0 + 1) / 2 skipped.
    assert.equal(report.schedule.avgEaten, 3)
    assert.equal(report.schedule.avgSkipped, 0.5)
    assert.equal(report.schedule.skippedBySlot.dinner, 1)
    assert.equal(report.schedule.averagePercent, 100)
    assert.deepEqual(report.schedule.byDay.map((day) => day.percent), [null, null, 100])
  })

  it('averages water over days with a record and keeps missing days separate', () => {
    const data = journal({ waters: [water(200), water(150), water(0, 'ml', '2026-11-17')] })
    const report = summarisePeriod(data, range)
    assert.equal(report.hydration.daysRecorded, 2)
    assert.equal(report.hydration.daysMissing, 1)
    assert.equal(report.hydration.averageMl, 175)
    assert.deepEqual(report.hydration.byDay.map((day) => day.ml), [null, 0, 350])
  })
})
