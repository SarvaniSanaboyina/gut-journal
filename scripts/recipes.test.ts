import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { foodMap } from '../src/foods.ts'
import { recipeNutrients } from '../src/recipes.ts'
import type { FoodEntry, Nutrients } from '../src/types.ts'

function food(id: string, values: Partial<Nutrients>, nutrientSource: FoodEntry['nutrientSource'] = 'ifct'): FoodEntry {
  const nutrients = {
    energyKcal: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, ironMg: null,
    calciumMg: null, vitaminDUg: null, zincMg: null, vitaminCMg: null, omega3G: null, ...values,
  }
  return {
    id, name: id, aliases: [], category: 'snacks', groups: [], defaultUnit: 'g', defaultQty: 100, unitGrams: {},
    nutrients, nutrientSource, sourceNote: '', ingredients: [], isCustom: false, isReference: true, recipe: null,
  }
}

const FOODS = foodMap([
  food('rava', { energyKcal: 350, proteinG: 10, ironMg: 1 }),
  food('ghee', { energyKcal: 900, proteinG: 0, ironMg: 0 }),
  food('jaggery', { energyKcal: 380, proteinG: 0.4, ironMg: null }),
  food('mithai', {}, 'none'),
])

const ing = (foodId: string, grams: number) => ({ foodId, name: foodId, quantity: grams, unit: 'g' as const, grams })

describe('recipe nutrients', () => {
  it('sums ingredients and divides by the finished weight', () => {
    // 100 g rava + 20 g ghee = 350 + 180 kcal; cooked to 300 g → 176.7 kcal per 100 g
    const result = recipeNutrients({ ingredients: [ing('rava', 100), ing('ghee', 20)], cookedGrams: 300, pieces: null }, FOODS)
    assert.ok(Math.abs(result.per100.energyKcal! - 530 / 3) < 1e-9)
    assert.equal(result.cookedGrams, 300)
  })

  it('uses the ingredients’ total weight when no finished weight is given, and sets a piece weight', () => {
    const result = recipeNutrients({ ingredients: [ing('rava', 100), ing('ghee', 20)], cookedGrams: null, pieces: 6 }, FOODS)
    assert.equal(result.cookedGrams, 120)
    assert.equal(result.pieceGrams, 20)
    assert.ok(Math.abs(result.per100.energyKcal! - (530 / 120) * 100) < 1e-9)
  })

  it('leaves a nutrient unknown when any ingredient lacks it, instead of guessing', () => {
    const result = recipeNutrients({ ingredients: [ing('rava', 100), ing('jaggery', 30)], cookedGrams: null, pieces: null }, FOODS)
    assert.equal(result.per100.ironMg, null)
    assert.notEqual(result.per100.energyKcal, null)
  })

  it('reports ingredients with no nutrient data', () => {
    const result = recipeNutrients({ ingredients: [ing('rava', 100), ing('mithai', 30)], cookedGrams: null, pieces: null }, FOODS)
    assert.deepEqual(result.withoutData, ['mithai'])
  })
})
