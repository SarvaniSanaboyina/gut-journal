import { gramsFor } from './foods'
import { NUTRIENT_ORDER } from './nutrition'
import type { FoodEntry, FoodUnit, Nutrients, Recipe } from './types'

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

/** One ingredient line in a recipe form: the food, the amount typed and its unit. */
export type Row = { key: string; food: FoodEntry; quantity: string; unit: FoodUnit }

/** Prefer a unit that converts to grams; reference foods are per gram. */
export function defaultUnitFor(food: FoodEntry): FoodUnit {
  return gramsFor(food, 1, food.defaultUnit) ? food.defaultUnit : 'g'
}

export function rowGrams(row: Row) {
  const quantity = Number(row.quantity)
  if (!row.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) return null
  return gramsFor(row.food, quantity, row.unit)?.grams ?? null
}

/** The recipe for saving or calculating, or null while an ingredient amount is missing or unconvertible. */
export function toRecipe(rows: Row[], cooked: string, pieces: string): Recipe | null {
  if (rows.length === 0) return null
  const ingredients = []
  for (const row of rows) {
    const grams = rowGrams(row)
    if (grams == null) return null
    ingredients.push({ foodId: row.food.id, name: row.food.name, quantity: Number(row.quantity), unit: row.unit, grams })
  }
  const cookedGrams = Number(cooked)
  const count = Number(pieces)
  return {
    ingredients,
    cookedGrams: cooked.trim() && Number.isFinite(cookedGrams) && cookedGrams > 0 ? cookedGrams : null,
    pieces: pieces.trim() && Number.isFinite(count) && count >= 1 ? Math.round(count) : null,
  }
}
