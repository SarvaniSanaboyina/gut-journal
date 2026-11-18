import type { FoodItem, Prisma, PrismaClient } from '@prisma/client'
import {
  FOOD_CATALOG,
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

export type NutrientSource = 'catalogue' | 'label' | 'none'

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
  ingredients: string[]
  isCustom: boolean
}

const NUTRIENT_SOURCES = ['catalogue', 'label', 'none'] as const
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
    ingredients: asStringArray(row.ingredients),
    isCustom: row.isCustom === true,
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
    ingredients: food.ingredients as Prisma.InputJsonValue,
    isCustom: food.isCustom,
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
    nutrientSource: known ? 'catalogue' : 'none',
    ingredients: food.ingredients ?? [],
    isCustom: false,
  }
}

/** Upsert the built-in catalogue. Custom foods are never overwritten. */
export async function seedFoodCatalog(db: PrismaClient) {
  const existing = await db.foodItem.findMany({ where: { isCustom: true }, select: { id: true } })
  const customIds = new Set(existing.map((row) => row.id))
  await db.$transaction(async (tx) => {
    for (const food of FOOD_CATALOG) {
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
  if (isRecord(value.nutrients)) {
    for (const key of NUTRIENT_KEYS) {
      nutrients[key] = parseOptionalNumber(value.nutrients[key], 'nutrient value', 1000)
    }
  }
  const hasNutrients = NUTRIENT_KEYS.some((key) => nutrients[key] != null)
  const groups = asStringArray(value.groups)
  const ingredients = asStringArray(value.ingredients).slice(0, 30)
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
    // Custom foods only carry nutrients a parent copied from a pack label (measured values).
    nutrientSource: hasNutrients ? 'label' : 'none',
    ingredients,
    isCustom: true,
  }
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
  const food = parseCustomFood(body)
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
