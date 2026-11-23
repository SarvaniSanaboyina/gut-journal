import type {
  FoodCategory,
  FoodEntry,
  FoodGroup,
  FoodUnit,
  MealEntry,
  MealIngredient,
  MealItem,
} from './types'

export const FOOD_CATEGORIES: { id: FoodCategory; label: string; icon: string; groups: FoodGroup[] }[] = [
  { id: 'cereals', label: 'Cereals & grains', icon: '🍚', groups: ['carbohydrate'] },
  { id: 'legumes', label: 'Legumes & pulses', icon: '🫘', groups: ['protein'] },
  { id: 'vegetables', label: 'Vegetables', icon: '🥕', groups: ['vegetable'] },
  { id: 'fruits', label: 'Fruits', icon: '🍌', groups: ['fruit'] },
  { id: 'dairy', label: 'Dairy', icon: '🥛', groups: ['protein'] },
  { id: 'protein', label: 'Protein sources', icon: '🥚', groups: ['protein'] },
  { id: 'fats', label: 'Healthy fats', icon: '🥥', groups: ['fat'] },
  { id: 'snacks', label: 'Snacks & processed', icon: '🍪', groups: [] },
  { id: 'beverages', label: 'Beverages', icon: '🥤', groups: [] },
]

export const FOOD_GROUPS: { id: FoodGroup; label: string; short: string; color: string }[] = [
  { id: 'carbohydrate', label: 'Carbohydrates', short: 'Carbs', color: '#2a78d6' },
  { id: 'protein', label: 'Protein', short: 'Protein', color: '#eb6834' },
  { id: 'vegetable', label: 'Vegetables', short: 'Veg', color: '#1baf7a' },
  { id: 'fruit', label: 'Fruits', short: 'Fruit', color: '#eda100' },
  { id: 'fat', label: 'Healthy fats', short: 'Fats', color: '#e87ba4' },
]

export const FOOD_UNITS: { id: FoodUnit; label: string; singular: string }[] = [
  { id: 'pieces', label: 'pieces', singular: 'piece' },
  { id: 'spoons', label: 'spoons', singular: 'spoon' },
  { id: 'bowls', label: 'bowls', singular: 'bowl' },
  { id: 'cups', label: 'cups', singular: 'cup' },
  { id: 'g', label: 'g', singular: 'g' },
  { id: 'ml', label: 'ml', singular: 'ml' },
]

/** Quick consumption choices. `null` percent keeps "not recorded". */
export const CONSUMPTION_CHOICES: { percent: number; label: string; short: string }[] = [
  { percent: 150, label: 'Had more than served (second helping)', short: 'More' },
  { percent: 100, label: 'Ate everything', short: 'All' },
  { percent: 75, label: 'Ate most', short: 'Most' },
  { percent: 50, label: 'Ate half', short: 'Half' },
  { percent: 25, label: 'Ate a little', short: 'Little' },
  { percent: 0, label: 'Refused', short: 'Refused' },
]

export const PREPARATION_METHODS = [
  'Boiled',
  'Steamed',
  'Mashed',
  'Pressure-cooked',
  'Sautéed',
  'Fried',
  'Roasted',
  'Baked',
  'Raw',
]

export const MEAL_SOURCES: { id: Exclude<MealEntry['source'], ''>; label: string }[] = [
  { id: 'homemade', label: 'Homemade' },
  { id: 'packaged', label: 'Packaged' },
  { id: 'restaurant', label: 'Restaurant' },
]

/**
 * Household measures used only when a food has no measure of its own. A katori-sized
 * bowl, a 200 ml tumbler cup and a tablespoon. Pieces are never guessed.
 */
const GENERIC_GRAMS: Partial<Record<FoodUnit, number>> = {
  g: 1,
  ml: 1,
  bowls: 150,
  cups: 200,
  spoons: 15,
}

export function categoryMeta(category: FoodCategory) {
  return FOOD_CATEGORIES.find((item) => item.id === category) ?? FOOD_CATEGORIES[FOOD_CATEGORIES.length - 1]
}

export function groupMeta(group: FoodGroup) {
  return FOOD_GROUPS.find((item) => item.id === group)!
}

export function unitLabel(unit: FoodUnit, quantity: number | null = 2): string {
  const meta = FOOD_UNITS.find((item) => item.id === unit)
  if (!meta) return unit
  return quantity != null && quantity <= 1 ? meta.singular : meta.label
}

export function formatAmount(quantity: number, unit: FoodUnit): string {
  const rounded = unit === 'g' || unit === 'ml' ? Math.round(quantity) : Math.round(quantity * 20) / 20
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/^0\./, '0.')
  if (unit === 'g' || unit === 'ml') return `${text} ${unit}`
  const fraction = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[rounded % 1] ?? null
  const whole = Math.floor(rounded)
  const pretty = fraction ? `${whole ? whole : ''}${fraction}` : text
  return `${pretty} ${unitLabel(unit, rounded)}`
}

/**
 * Grams for a quantity of a food. Returns `null` when the quantity cannot be converted
 * reliably (no quantity, or "pieces" of a food with no known piece weight).
 */
export function gramsFor(food: FoodEntry | undefined, quantity: number | null, unit: FoodUnit): { grams: number; generic: boolean } | null {
  if (quantity == null || !Number.isFinite(quantity)) return null
  if (unit === 'g') return { grams: quantity, generic: false }
  const own = food?.unitGrams[unit]
  if (own != null) return { grams: quantity * own, generic: false }
  const generic = GENERIC_GRAMS[unit]
  if (generic == null) return null
  return { grams: quantity * generic, generic: unit !== 'ml' }
}

/** Amount eaten in the item's own unit, or `null` when it was not recorded. */
export function consumedQuantity(item: MealIngredient): number | null {
  if (item.quantityConsumed != null) return item.quantityConsumed
  if (item.quantityServed != null && item.consumedPercent != null) {
    return (item.quantityServed * item.consumedPercent) / 100
  }
  return null
}

/** Percent of what was served that was eaten, or `null` if unknown. */
export function consumedPercent(item: MealIngredient): number | null {
  if (item.consumedPercent != null) return item.consumedPercent
  if (item.quantityServed != null && item.quantityConsumed != null && item.quantityServed > 0) {
    return Math.round((item.quantityConsumed / item.quantityServed) * 100)
  }
  return null
}

/** A food counts as eaten unless it was recorded as refused. Unknown amounts still count as exposure. */
export function wasEaten(item: MealIngredient): boolean {
  const percent = consumedPercent(item)
  if (percent != null) return percent > 0
  if (item.quantityConsumed != null) return item.quantityConsumed > 0
  return true
}

export function consumptionLabel(percent: number | null): string {
  if (percent == null) return 'Amount eaten not recorded'
  if (percent > 100) return 'Had more than served'
  if (percent >= 100) return 'Ate everything'
  if (percent >= 70) return 'Ate most'
  if (percent >= 40) return 'Ate half'
  if (percent > 0) return 'Ate a little'
  return 'Refused'
}

function normalise(text: string) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').trim()
}

export function searchFoods(foods: FoodEntry[], query: string, limit = 12): FoodEntry[] {
  const q = normalise(query)
  if (!q) return []
  const scored: { food: FoodEntry; score: number }[] = []
  for (const food of foods) {
    const names = [food.name, ...food.aliases].map(normalise)
    let score = 0
    for (const name of names) {
      if (name === q) score = Math.max(score, 100)
      else if (name.startsWith(q)) score = Math.max(score, 80)
      else if (name.split(' ').some((word) => word.startsWith(q))) score = Math.max(score, 60)
      else if (name.includes(q)) score = Math.max(score, 40)
    }
    // Everyday and family foods rank above the raw IFCT reference entries with similar names.
    if (score) scored.push({ food, score: score + (food.isCustom ? 5 : 0) + (food.isReference ? 0 : 25) })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((item) => item.food)
}

export function foodMap(foods: FoodEntry[]) {
  return new Map(foods.map((food) => [food.id, food]))
}

function byNewest(a: MealEntry, b: MealEntry) {
  return `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
}

/** Most recently eaten foods, newest first. */
export function recentFoods(meals: MealEntry[], foods: FoodEntry[], limit = 10): FoodEntry[] {
  const byId = foodMap(foods)
  const seen = new Set<string>()
  const result: FoodEntry[] = []
  for (const meal of [...meals].sort(byNewest)) {
    for (const item of meal.items) {
      if (!item.foodId || seen.has(item.foodId)) continue
      const food = byId.get(item.foodId)
      if (!food) continue
      seen.add(item.foodId)
      result.push(food)
      if (result.length >= limit) return result
    }
  }
  return result
}

/** Distinct recent meals (by their food list) to repeat with one tap. */
export function recentMealTemplates(meals: MealEntry[], type: MealEntry['type'], limit = 3): MealEntry[] {
  const seen = new Set<string>()
  const sorted = [...meals].filter((meal) => meal.items.length > 0).sort(byNewest)
  const preferred = [...sorted.filter((meal) => meal.type === type), ...sorted.filter((meal) => meal.type !== type)]
  const result: MealEntry[] = []
  for (const meal of preferred) {
    const key = meal.items.map((item) => item.foodId ?? item.name).sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(meal)
    if (result.length >= limit) break
  }
  return result
}

/** Foods most often eaten overall, for the "Common" shelf when there is no history yet. */
export const COMMON_FOOD_IDS = [
  'idli',
  'dosa',
  'rice',
  'chapati',
  'dal',
  'sambar',
  'curd',
  'milk',
  'banana',
  'egg',
  'ragi-porridge',
  'khichdi',
  'apple',
  'papaya',
  'carrot',
  'paneer',
]

export function newItem(food: FoodEntry | null, name?: string): MealItem {
  return {
    id: crypto.randomUUID(),
    foodId: food?.id ?? null,
    name: food?.name ?? name ?? '',
    quantityServed: food?.defaultQty ?? 1,
    quantityConsumed: food?.defaultQty ?? 1,
    unit: food?.defaultUnit ?? 'pieces',
    consumedPercent: 100,
    preparation: '',
    notes: '',
    ingredients: [],
  }
}

export function newIngredient(food: FoodEntry | null, name?: string): MealIngredient {
  return {
    id: crypto.randomUUID(),
    foodId: food?.id ?? null,
    name: food?.name ?? name ?? '',
    quantityServed: null,
    quantityConsumed: null,
    unit: food?.defaultUnit ?? 'g',
    consumedPercent: null,
    preparation: '',
    notes: '',
  }
}

/** Items with built-in ingredients pre-filled from the catalogue, so composite dishes are tracked. */
export function itemWithDefaultIngredients(food: FoodEntry, foods: Map<string, FoodEntry>): MealItem {
  const item = newItem(food)
  item.ingredients = food.ingredients
    .map((id) => foods.get(id))
    .filter((child): child is FoodEntry => Boolean(child))
    .map((child) => newIngredient(child))
  return item
}

export function copyItems(items: MealItem[]): MealItem[] {
  return items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    quantityConsumed: item.quantityServed,
    consumedPercent: 100,
    ingredients: item.ingredients.map((child) => ({ ...child, id: crypto.randomUUID() })),
  }))
}

/** Every food eaten in a meal, including composite-dish ingredients, as `{ id|name, item }`. */
export function eatenFoods(meal: MealEntry): { key: string; name: string; foodId: string | null; item: MealIngredient; parent?: MealItem }[] {
  const result: { key: string; name: string; foodId: string | null; item: MealIngredient; parent?: MealItem }[] = []
  for (const item of meal.items) {
    if (!wasEaten(item)) continue
    result.push({ key: item.foodId ?? `name:${item.name.toLowerCase()}`, name: item.name, foodId: item.foodId, item })
    for (const child of item.ingredients) {
      result.push({ key: child.foodId ?? `name:${child.name.toLowerCase()}`, name: child.name, foodId: child.foodId, item: child, parent: item })
    }
  }
  return result
}
