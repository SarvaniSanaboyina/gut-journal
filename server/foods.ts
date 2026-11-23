import type { FoodItem, Prisma, PrismaClient } from '@prisma/client'
import {
  FOOD_CATALOG,
  REFERENCE_FOODS,
  FOOD_CATEGORIES,
  FOOD_GROUPS,
  FOOD_UNITS,
  NUTRIENT_KEYS,
  type CatalogFood,
  type FoodCategory,
  type FoodGroup,
  type FoodUnit,
  type Nutrients,
  type UnitGrams,
} from './foodCatalog.ts'
import {
  bad,
  type Db,
  isRecord,
  oneOf,
  parseId,
  parseOptionalNumber,
  parseText,
  recordRevision,
} from './validate.ts'

/** ifct = one IFCT 2017 food; recipe = standard recipe from IFCT 2017 ingredients; catalogue = approximate estimate. */
export type NutrientSource = 'ifct' | 'recipe' | 'catalogue' | 'label' | 'none'

/** A home recipe: ingredients with the grams used, and what the finished dish weighs or makes. */
export type RecipeIngredient = { foodId: string; name: string; quantity: number; unit: FoodUnit; grams: number }
export type Recipe = {
  ingredients: RecipeIngredient[]
  /** Weight of the finished dish; defaults to the sum of the ingredients (no water gained or lost). */
  cookedGrams: number | null
  /** How many pieces/servings it makes, which sets the weight of one piece. */
  pieces: number | null
}

const MAX_RECIPE_INGREDIENTS = 40

export type FoodEntry = {
  id: string
  name: string
  aliases: string[]
  category: FoodCategory
  groups: FoodGroup[]
  defaultUnit: FoodUnit
  defaultQty: number | null
  unitGrams: UnitGrams
  nutrients: Nutrients
  nutrientSource: NutrientSource
  /** Where the values come from, e.g. the IFCT code or the recipe used. */
  sourceNote: string
  ingredients: string[]
  isCustom: boolean
  /** A raw IFCT 2017 reference food: found by search, not shown on category shelves. */
  isReference: boolean
  /** Set for custom foods built from ingredients; nutrients are calculated from it on save. */
  recipe: Recipe | null
}

const NUTRIENT_SOURCES = ['ifct', 'recipe', 'catalogue', 'label', 'none'] as const
const MAX_NAME = 80
const MAX_CUSTOM_FOODS = 2000

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function emptyNutrients(): Nutrients {
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, null])) as Nutrients
}

function readNutrients(value: unknown): Nutrients {
  const nutrients = emptyNutrients()
  if (!isRecord(value)) return nutrients
  for (const key of NUTRIENT_KEYS) {
    const raw = value[key]
    nutrients[key] = typeof raw === 'number' && Number.isFinite(raw) ? raw : null
  }
  return nutrients
}

function readUnitGrams(value: unknown): UnitGrams {
  const result: UnitGrams = {}
  if (!isRecord(value)) return result
  for (const unit of FOOD_UNITS) {
    if (unit === 'g') continue
    const raw = value[unit]
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) result[unit] = raw
  }
  return result
}

export function foodFromRow(row: FoodItem): FoodEntry {
  return {
    id: row.id,
    name: row.name,
    aliases: asStringArray(row.aliases),
    category: row.category as FoodCategory,
    groups: asStringArray(row.foodGroups).filter((item): item is FoodGroup =>
      (FOOD_GROUPS as readonly string[]).includes(item),
    ),
    defaultUnit: row.defaultUnit as FoodUnit,
    defaultQty: row.defaultQty == null ? null : Number(row.defaultQty),
    unitGrams: readUnitGrams(row.unitGrams),
    nutrients: readNutrients(row.nutrients),
    nutrientSource: (NUTRIENT_SOURCES as readonly string[]).includes(row.nutrientSource)
      ? (row.nutrientSource as NutrientSource)
      : 'none',
    sourceNote: row.sourceNote,
    ingredients: asStringArray(row.ingredients),
    isCustom: row.isCustom === true,
    isReference: row.isReference === true,
    recipe: readRecipe(row.recipe),
  }
}

function rowData(food: Omit<FoodEntry, 'id'>) {
  return {
    name: food.name,
    aliases: food.aliases as Prisma.InputJsonValue,
    category: food.category,
    foodGroups: food.groups as Prisma.InputJsonValue,
    defaultUnit: food.defaultUnit,
    defaultQty: food.defaultQty,
    unitGrams: food.unitGrams as Prisma.InputJsonValue,
    nutrients: food.nutrients as Prisma.InputJsonValue,
    nutrientSource: food.nutrientSource,
    sourceNote: food.sourceNote,
    ingredients: food.ingredients as Prisma.InputJsonValue,
    isCustom: food.isCustom,
    isReference: food.isReference,
    recipe: (food.recipe ?? null) as Prisma.InputJsonValue,
  }
}

function catalogEntry(food: CatalogFood): FoodEntry {
  const known = NUTRIENT_KEYS.some((key) => food.nutrients[key] != null)
  return {
    id: food.id,
    name: food.name,
    aliases: food.aliases ?? [],
    category: food.category,
    groups: food.groups,
    defaultUnit: food.defaultUnit,
    defaultQty: food.defaultQty,
    unitGrams: food.unitGrams,
    nutrients: food.nutrients,
    nutrientSource: !known ? 'none' : food.source === 'ifct' ? 'ifct' : food.source === 'recipe' ? 'recipe' : 'catalogue',
    sourceNote: food.compositionNote ?? (known ? 'Approximate value — not in IFCT 2017' : ''),
    ingredients: food.ingredients ?? [],
    isCustom: false,
    isReference: food.reference === true,
    recipe: null,
  }
}

/** Upsert the built-in catalogue. Custom foods are never overwritten. */
export async function seedFoodCatalog(db: PrismaClient) {
  const existing = await db.foodItem.findMany({ where: { isCustom: true }, select: { id: true } })
  const customIds = new Set(existing.map((row) => row.id))
  await db.$transaction(async (tx) => {
    for (const food of [...FOOD_CATALOG, ...REFERENCE_FOODS]) {
      if (customIds.has(food.id)) continue
      const { id, ...data } = catalogEntry(food)
      await tx.foodItem.upsert({ where: { id }, create: { id, ...rowData(data) }, update: rowData(data) })
    }
  })
}

export function parseCustomFood(value: unknown, loose = false): FoodEntry {
  if (!isRecord(value)) return bad('Invalid food')
  const name = parseText(value.name, MAX_NAME)
  if (!name) return bad('A food needs a name')
  const nutrients = emptyNutrients()
  // A recipe's nutrients are recalculated from its ingredients on save, so client values are
  // ignored; a backup import keeps the stored values it was exported with.
  if (isRecord(value.nutrients) && (loose || !isRecord(value.recipe))) {
    for (const key of NUTRIENT_KEYS) {
      nutrients[key] = parseOptionalNumber(value.nutrients[key], 'nutrient value', 1000)
    }
  }
  const hasNutrients = NUTRIENT_KEYS.some((key) => nutrients[key] != null)
  const groups = asStringArray(value.groups)
  const ingredients = asStringArray(value.ingredients).slice(0, 30)
  const recipe = parseRecipe(value.recipe)
  return {
    id: parseId(value.id, loose),
    name,
    aliases: asStringArray(value.aliases).map((item) => item.trim()).filter(Boolean).slice(0, 10),
    category: oneOf(typeof value.category === 'string' ? value.category : 'snacks', FOOD_CATEGORIES, 'food category'),
    groups: [...new Set(groups.map((group) => oneOf(group, FOOD_GROUPS, 'food group')))],
    defaultUnit: oneOf(typeof value.defaultUnit === 'string' ? value.defaultUnit : 'pieces', FOOD_UNITS, 'unit'),
    defaultQty: parseOptionalNumber(value.defaultQty, 'default quantity', 5000),
    unitGrams: readUnitGrams(value.unitGrams),
    nutrients,
    // Custom foods carry nutrients copied from a pack label, or calculated from a recipe on save.
    nutrientSource: recipe && hasNutrients ? 'recipe' : hasNutrients ? 'label' : 'none',
    sourceNote: recipe && hasNutrients ? recipeNote(recipe) : hasNutrients ? 'Entered from a pack label' : '',
    ingredients,
    isCustom: true,
    isReference: false,
    recipe,
  }
}

function readRecipe(value: unknown): Recipe | null {
  if (!isRecord(value) || !Array.isArray(value.ingredients)) return null
  try {
    return parseRecipe(value)
  } catch {
    return null
  }
}

export function parseRecipe(value: unknown): Recipe | null {
  if (value == null) return null
  if (!isRecord(value) || !Array.isArray(value.ingredients)) return bad('Invalid recipe')
  if (value.ingredients.length === 0) return bad('Add at least one ingredient')
  if (value.ingredients.length > MAX_RECIPE_INGREDIENTS) return bad('Too many ingredients')
  const ingredients = value.ingredients.map((raw) => {
    if (!isRecord(raw)) return bad('Invalid ingredient')
    const name = parseText(raw.name, MAX_NAME)
    const grams = parseOptionalNumber(raw.grams, 'ingredient weight', 10000)
    if (!grams || grams <= 0) return bad(`${name || 'An ingredient'}: enter how much was used`)
    return {
      foodId: parseId(raw.foodId),
      name,
      quantity: parseOptionalNumber(raw.quantity, 'ingredient amount', 10000) ?? grams,
      unit: oneOf(typeof raw.unit === 'string' ? raw.unit : 'g', FOOD_UNITS, 'unit'),
      grams,
    }
  })
  const cookedGrams = parseOptionalNumber(value.cookedGrams, 'cooked weight', 50000)
  const pieces = parseOptionalNumber(value.pieces, 'number of pieces', 1000)
  return { ingredients, cookedGrams: cookedGrams || null, pieces: pieces ? Math.round(pieces) : null }
}

function recipeNote(recipe: Recipe) {
  const total = recipe.ingredients.reduce((sum, item) => sum + item.grams, 0)
  const cooked = recipe.cookedGrams ?? total
  const parts = recipe.ingredients.map((item) => `${Math.round(item.grams)} g ${item.name.toLowerCase()}`).join(', ')
  return `Your recipe: ${parts} → ${Math.round(cooked)} g${recipe.pieces ? `, ${recipe.pieces} pieces` : ''}`
}

/**
 * Per-100 g nutrients of a recipe from its ingredients' stored values. A nutrient that any
 * ingredient lacks is left unknown rather than guessed; an ingredient with no data at all is refused.
 */
export async function calculateRecipe(db: Db, recipe: Recipe, selfId?: string) {
  const ids = [...new Set(recipe.ingredients.map((item) => item.foodId))]
  if (selfId && ids.includes(selfId)) return bad('A recipe cannot include itself')
  const rows = await db.foodItem.findMany({ where: { id: { in: ids } } })
  const foods = new Map(rows.map((row) => [row.id, foodFromRow(row)]))
  const totals = emptyNutrients()
  for (const key of NUTRIENT_KEYS) totals[key] = 0
  for (const item of recipe.ingredients) {
    const food = foods.get(item.foodId)
    if (!food) return bad(`${item.name} is not in the food list`)
    if (food.nutrientSource === 'none') return bad(`${food.name} has no nutrient data — pick a similar food from the list`)
    for (const key of NUTRIENT_KEYS) {
      const value = food.nutrients[key]
      totals[key] = value == null || totals[key] == null ? null : totals[key]! + (value * item.grams) / 100
    }
  }
  const cooked = recipe.cookedGrams ?? recipe.ingredients.reduce((sum, item) => sum + item.grams, 0)
  const per100 = emptyNutrients()
  for (const key of NUTRIENT_KEYS) {
    per100[key] = totals[key] == null ? null : Math.round((totals[key]! / cooked) * 100 * 1000) / 1000
  }
  return { nutrients: per100, cookedGrams: cooked, ingredientIds: ids }
}

export async function listFoods(db: Db): Promise<FoodEntry[]> {
  const rows = await db.foodItem.findMany({ orderBy: [{ isCustom: 'desc' }, { name: 'asc' }] })
  return rows.map(foodFromRow)
}

export async function upsertCustomFood(db: Db, food: FoodEntry) {
  const { id, ...data } = food
  await db.foodItem.upsert({ where: { id }, create: { id, ...rowData(data) }, update: rowData(data) })
}

export async function saveCustomFood(db: PrismaClient, body: unknown): Promise<FoodEntry> {
  let food = parseCustomFood(body)
  if (food.recipe) {
    // Nutrients are always recalculated from the ingredients on the server, never taken from the client.
    const result = await calculateRecipe(db, food.recipe, food.id)
    food = {
      ...food,
      nutrients: result.nutrients,
      nutrientSource: 'recipe',
      sourceNote: recipeNote(food.recipe),
      // Ingredients are linked so food-reaction tracking sees them when the dish is eaten.
      ingredients: result.ingredientIds,
      unitGrams: food.recipe.pieces ? { ...food.unitGrams, pieces: Math.round((result.cookedGrams / food.recipe.pieces) * 10) / 10 } : food.unitGrams,
    }
  }
  const existing = await db.foodItem.findUnique({ where: { id: food.id } })
  if (existing && !existing.isCustom) return bad('Built-in foods cannot be changed. Add a custom food instead.')
  if (!existing && (await db.foodItem.count({ where: { isCustom: true } })) >= MAX_CUSTOM_FOODS) {
    return bad('Too many custom foods')
  }
  await db.$transaction(async (tx) => {
    if (existing) await recordRevision(tx, 'food', food.id, 'update', foodFromRow(existing))
    await upsertCustomFood(tx, food)
  })
  return food
}

export async function removeCustomFood(db: PrismaClient, idValue: string) {
  const id = parseId(idValue)
  const existing = await db.foodItem.findUnique({ where: { id } })
  if (!existing) return
  if (!existing.isCustom) return bad('Built-in foods cannot be deleted')
  await db.$transaction(async (tx) => {
    await recordRevision(tx, 'food', id, 'delete', foodFromRow(existing))
    // Meal items keep their food name snapshot; the link is cleared by ON DELETE SET NULL.
    await tx.foodItem.delete({ where: { id } })
  })
}
