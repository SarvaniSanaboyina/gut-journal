import { NUTRIENT_ORDER } from './nutrition'
import type { FoodEntry, Nutrients, Recipe } from './types'

/**
 * Per-100 g nutrients of a home recipe from its ingredients (the same calculation the server
 * repeats on save). A nutrient that any ingredient lacks stays unknown rather than being guessed.
 */
export function recipeNutrients(recipe: Recipe, foods: Map<string, FoodEntry>) {
  const totals = Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, 0])) as Nutrients
  const withoutData: string[] = []
  for (const item of recipe.ingredients) {
    const food = foods.get(item.foodId)
    if (!food || food.nutrientSource === 'none') {
      withoutData.push(item.name)
      continue
    }
    for (const key of NUTRIENT_ORDER) {
      const value = food.nutrients[key]
      totals[key] = value == null || totals[key] == null ? null : totals[key]! + (value * item.grams) / 100
    }
  }
  const rawGrams = recipe.ingredients.reduce((sum, item) => sum + item.grams, 0)
  const cooked = recipe.cookedGrams ?? rawGrams
  const per100 = Object.fromEntries(
    NUTRIENT_ORDER.map((key) => [key, totals[key] == null || cooked <= 0 ? null : (totals[key]! / cooked) * 100]),
  ) as Nutrients
  const pieceGrams = recipe.pieces ? cooked / recipe.pieces : null
  return { per100, totals, rawGrams, cookedGrams: cooked, pieceGrams, withoutData }
}
