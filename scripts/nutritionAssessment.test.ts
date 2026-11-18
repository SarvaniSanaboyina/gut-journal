import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assessDay, DEFAULT_ASSESSMENT } from '../src/nutritionAssessment.ts'
import { emptyJournal, type FoodEntry, type MealEntry, type MealItem, type Nutrients, type Settings } from '../src/types.ts'

const DATE = '2026-11-18'
const TODDLER = '2024-06-01' // 2 years old → ICMR 1–3 band
const PRESCHOOLER = '2021-06-01' // 5 years old → 4–6 band

function nutrients(values: Partial<Nutrients>): Nutrients {
  return {
    energyKcal: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, ironMg: null,
    calciumMg: null, vitaminDUg: null, zincMg: null, vitaminCMg: null, omega3G: null, ...values,
  }
}

function food(id: string, values: Partial<Nutrients>, source: FoodEntry['nutrientSource'] = 'ifct'): FoodEntry {
  return {
    id, name: id, aliases: [], category: 'cereals', groups: [], defaultUnit: 'g', defaultQty: 100, unitGrams: {},
    nutrients: nutrients(values), nutrientSource: source, sourceNote: '', ingredients: [], isCustom: false,
  }
}

/**
 * 1000 g of "balanced" ≈ the 1–3 y references: 1110 kcal, 20 g protein (7 % of energy),
 * 152 g carbs (55 %), 43 g fat (35 %), 15 g fibre, 8 mg iron, 500 mg calcium, 3.3 mg zinc, 30 mg vitamin C.
 */
const BALANCED = food('balanced', {
  energyKcal: 111, proteinG: 2, carbsG: 15.2, fatG: 4.3, fibreG: 1.5, ironMg: 0.8, calciumMg: 50,
  vitaminDUg: 0, zincMg: 0.33, vitaminCMg: 3, omega3G: 0.07,
})
const IRON_SUPPLEMENTED = food('iron-drops', { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0, ironMg: 5000, calciumMg: 0, zincMg: 0, vitaminCMg: 0 })
const ZINC_RICH = food('zinc-rich', { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0, ironMg: 0, calciumMg: 0, zincMg: 1000, vitaminCMg: 0 })
const UNKNOWN = food('mithai', {}, 'none')
const GHEE = food('ghee', { energyKcal: 900, proteinG: 0, carbsG: 0, fatG: 100, fibreG: 0, ironMg: 0, calciumMg: 0, zincMg: 0, vitaminCMg: 0 })
const FOODS = [BALANCED, IRON_SUPPLEMENTED, ZINC_RICH, UNKNOWN, GHEE]

function item(foodId: string, grams: number | null, percent = 100): MealItem {
  return {
    id: `${foodId}-${Math.random()}`, foodId, name: foodId, quantityServed: grams, quantityConsumed: grams == null ? null : (grams * percent) / 100,
    unit: 'g', consumedPercent: percent, preparation: '', notes: '', ingredients: [],
  }
}

function meal(items: MealItem[]): MealEntry {
  return {
    id: `m-${Math.random()}`, date: DATE, time: '12:00', endTime: '', type: 'lunch', foods: '', quantity: null, quantityUnit: 'spoons',
    consistency: 'solid', consistencyPercent: null, calories: null, notes: '', hasBeforePhoto: false, hasAfterPhoto: false, source: '', items,
  }
}

function settings(birthDate = TODDLER, overrides: Settings['nutritionAssessment'] = {}): Settings {
  return { ...emptyJournal().settings, childProfile: { sex: 'female', birthDate }, nutritionAssessment: overrides }
}

const assess = (items: MealItem[], s = settings()) => assessDay([meal(items)], FOODS, s, DATE)
const status = (day: ReturnType<typeof assessDay>, key: string) => day.nutrients.find((item) => item.key === key)!.status

describe('per-nutrient assessment', () => {
  it('rates intake near the references as within range, with amounts and references', () => {
    const day = assess([item('balanced', 1000)])
    assert.equal(day.status, 'within')
    const protein = day.nutrients.find((n) => n.key === 'proteinG')!
    assert.equal(protein.amount, 20)
    assert.equal(protein.reference, 12.5)
    for (const key of ['energyKcal', 'fibreG', 'ironMg', 'calciumMg', 'zincMg', 'vitaminCMg', 'carbsG', 'fatG']) {
      assert.equal(status(day, key), 'within', key)
    }
  })

  it('judges carbohydrate and fat as a share of energy (AMDR), not against a gram target', () => {
    const day = assess([item('balanced', 1000), item('ghee', 30)])
    assert.equal(status(day, 'fatG'), 'above') // 73 g fat ≈ 48 % of energy, above 30–40 %
    assert.equal(status(day, 'carbsG'), 'below')
  })

  it('flags intake above the upper limit as a caution, not as healthy', () => {
    const day = assess([item('balanced', 1000), item('iron-drops', 1)])
    assert.equal(status(day, 'ironMg'), 'over-ul')
    assert.deepEqual(day.overUpperLimit, ['ironMg'])
    assert.equal(day.status, 'above')
  })

  it('uses age-specific upper limits', () => {
    // 3.3 mg + 10 mg zinc = 13.3 mg: above the 1–3 y UL (7 mg) and the 4–8 y UL (12 mg)
    assert.equal(status(assess([item('balanced', 1000), item('zinc-rich', 1)]), 'zincMg'), 'over-ul')
    // 3.3 + 5 = 8.3 mg: above the 1–3 y UL only
    assert.equal(status(assess([item('balanced', 1000), item('zinc-rich', 0.5)]), 'zincMg'), 'over-ul')
    assert.notEqual(status(assess([item('balanced', 1000), item('zinc-rich', 0.5)], settings(PRESCHOOLER)), 'zincMg'), 'over-ul')
  })

  it('treats a recommended-intake nutrient above the reference but under the UL as "above", not a problem', () => {
    const day = assess([item('balanced', 1000), item('iron-drops', 0.2)]) // 8 + 10 = 18 mg iron
    assert.equal(status(day, 'ironMg'), 'above')
    assert.equal(day.status, 'within')
  })
})

describe('day status', () => {
  it('is below when energy is below the requirement', () => {
    assert.equal(assess([item('balanced', 500)]).status, 'below')
  })

  it('is above when energy is well above the requirement', () => {
    assert.equal(assess([item('balanced', 1500)]).status, 'above')
  })

  it('does not average nutrients: one high value cannot hide low energy', () => {
    const day = assess([item('balanced', 500), item('iron-drops', 0.6)]) // 34 mg iron, under UL; energy 50 %
    assert.equal(day.status, 'below')
  })

  it('is insufficient (not below) when foods without data make the estimate unreliable', () => {
    const day = assess([item('balanced', 500), item('mithai', 100)])
    assert.equal(status(day, 'energyKcal'), 'insufficient')
    assert.equal(day.status, 'insufficient')
    assert.deepEqual(day.missing.map((m) => m.name), ['mithai'])
  })

  it('treats an eaten food with no recorded amount as missing data, not zero', () => {
    const day = assess([item('balanced', 500), item('balanced', null)])
    assert.equal(day.status, 'insufficient')
    assert.equal(day.missing[0].reason, 'Amount eaten not recorded')
  })

  it('still uses a known amount as a lower bound when it already meets the reference', () => {
    const day = assess([item('balanced', 1000), item('mithai', 100)])
    const iron = day.nutrients.find((n) => n.key === 'ironMg')!
    assert.equal(iron.status, 'within')
    assert.equal(iron.partial, true)
  })

  it('ignores refused foods and reports no food when nothing was eaten', () => {
    assert.equal(assess([item('balanced', 1000, 0)]).status, 'no-food')
  })

  it('follows configuration', () => {
    const tight = settings(TODDLER, { lowPercent: 95 })
    assert.equal(assess([item('balanced', 900)]).status, 'within') // 90 % of energy
    assert.equal(assess([item('balanced', 900)], tight).status, 'below')
    assert.equal(DEFAULT_ASSESSMENT.keyNutrients.includes('vitaminDUg'), false)
  })
})
