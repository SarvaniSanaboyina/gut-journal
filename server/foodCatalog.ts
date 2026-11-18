import { IFCT } from './ifctData.ts'
/**
 * Built-in food catalogue. It is upserted into `food_items` on every boot, so editing
 * this file updates the catalogue; parents' custom foods live in the same table with
 * `is_custom = true` and are never touched by the seed.
 *
 * Nutrients are per 100 g of the food *as eaten* (cooked where relevant). They are
 * approximate values compiled from the Indian Food Composition Tables (IFCT 2017,
 * NIN Hyderabad) and USDA FoodData Central (SR Legacy). Home recipes vary a lot, so
 * every value derived from them is shown to parents as an estimate. `null` means the
 * value is unknown and is never treated as zero.
 */

export const FOOD_CATEGORIES = [
  'cereals',
  'fruits',
  'vegetables',
  'dairy',
  'protein',
  'legumes',
  'fats',
  'snacks',
  'beverages',
] as const

export const FOOD_GROUPS = ['carbohydrate', 'protein', 'vegetable', 'fruit', 'fat'] as const

export const FOOD_UNITS = ['g', 'ml', 'pieces', 'cups', 'bowls', 'spoons'] as const

export const NUTRIENT_KEYS = [
  'energyKcal',
  'proteinG',
  'carbsG',
  'fatG',
  'fibreG',
  'ironMg',
  'calciumMg',
  'vitaminDUg',
  'zincMg',
  'vitaminCMg',
  'omega3G',
] as const

export type FoodCategory = (typeof FOOD_CATEGORIES)[number]
export type FoodGroup = (typeof FOOD_GROUPS)[number]
export type FoodUnit = (typeof FOOD_UNITS)[number]
export type NutrientKey = (typeof NUTRIENT_KEYS)[number]
export type Nutrients = Record<NutrientKey, number | null>

/** Grams for one household unit of this food. `g` is always 1; ml uses `density` (default 1). */
export type UnitGrams = Partial<Record<Exclude<FoodUnit, 'g'>, number>>

export type CatalogFood = {
  id: string
  name: string
  aliases?: string[]
  category: FoodCategory
  groups: FoodGroup[]
  defaultUnit: FoodUnit
  defaultQty: number
  unitGrams: UnitGrams
  nutrients: Nutrients
  ingredients?: string[]
  /** Set from COMPOSITION below. */
  source?: CompositionSource
  compositionNote?: string
}

/** kcal, protein g, carbs g, fat g, fibre g, iron mg, calcium mg, vitamin D µg, zinc mg, vitamin C mg, omega-3 g */
function n(
  energyKcal: number | null,
  proteinG: number | null,
  carbsG: number | null,
  fatG: number | null,
  fibreG: number | null,
  ironMg: number | null,
  calciumMg: number | null,
  vitaminDUg: number | null,
  zincMg: number | null,
  vitaminCMg: number | null,
  omega3G: number | null,
): Nutrients {
  return {
    energyKcal,
    proteinG,
    carbsG,
    fatG,
    fibreG,
    ironMg,
    calciumMg,
    vitaminDUg,
    zincMg,
    vitaminCMg,
    omega3G,
  }
}

const BOWL_COOKED = { bowls: 150, cups: 160, spoons: 15 }
const LIQUID = { cups: 200, bowls: 150, spoons: 15, ml: 1 }
const FRUIT_PIECES = { cups: 150, bowls: 120, spoons: 15 }
const VEG_COOKED = { bowls: 100, cups: 130, spoons: 15 }

export const FOOD_CATALOG: CatalogFood[] = [
  // Cereals and grains
  { id: 'rice', name: 'Rice', aliases: ['white rice', 'annam', 'chawal'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(130, 2.7, 28, 0.3, 0.4, 0.2, 10, 0, 0.5, 0, 0) },
  { id: 'idli', name: 'Idli', category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'pieces', defaultQty: 2, unitGrams: { pieces: 40 }, nutrients: n(130, 4, 27, 0.4, 1, 0.6, 15, 0, 0.4, 0, null), ingredients: ['rice', 'urad-dal'] },
  { id: 'dosa', name: 'Dosa', aliases: ['dosai', 'plain dosa'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 60 }, nutrients: n(170, 3.9, 27, 5, 1, 0.8, 15, 0, 0.5, 0, null), ingredients: ['rice', 'urad-dal'] },
  { id: 'uttapam', name: 'Uttapam', category: 'cereals', groups: ['carbohydrate', 'vegetable'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 80 }, nutrients: n(160, 4, 26, 4.5, 1.5, 0.8, 20, 0, 0.5, 3, null), ingredients: ['rice', 'urad-dal', 'onion', 'tomato'] },
  { id: 'chapati', name: 'Chapati', aliases: ['roti', 'phulka'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 35 }, nutrients: n(280, 9, 50, 4, 4.9, 2.5, 30, 0, 1.6, 0, null) },
  { id: 'paratha', name: 'Paratha', category: 'cereals', groups: ['carbohydrate', 'fat'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 60 }, nutrients: n(300, 7, 42, 11, 4, 2, 30, null, 1, 0, null) },
  { id: 'ragi-porridge', name: 'Ragi porridge', aliases: ['ragi malt', 'ragi kanji', 'finger millet'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'cups', defaultQty: 0.5, unitGrams: LIQUID, nutrients: n(90, 3, 14, 2.3, 1.2, 0.8, 110, null, 0.4, 0.5, null), ingredients: ['ragi-flour', 'milk'] },
  { id: 'ragi-flour', name: 'Ragi flour (dry)', aliases: ['finger millet flour', 'nachni'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'spoons', defaultQty: 2, unitGrams: { spoons: 10, cups: 120 }, nutrients: n(320, 7.2, 66.8, 1.9, 11.2, 4.6, 364, 0, 2.5, 0, null) },
  { id: 'pongal', name: 'Pongal', aliases: ['ven pongal', 'khara pongal'], category: 'cereals', groups: ['carbohydrate', 'protein'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(140, 4, 20, 4.5, 1.2, 0.6, 15, null, 0.6, 0, null), ingredients: ['rice', 'moong-dal', 'ghee'] },
  { id: 'khichdi', name: 'Khichdi', aliases: ['kichdi'], category: 'cereals', groups: ['carbohydrate', 'protein'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(120, 4.2, 20, 2.5, 1.5, 0.8, 15, null, 0.6, 0.5, null), ingredients: ['rice', 'moong-dal', 'ghee'] },
  { id: 'curd-rice', name: 'Curd rice', aliases: ['thayir sadam', 'mosaru anna'], category: 'cereals', groups: ['carbohydrate', 'protein'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(110, 3, 18, 2.8, 0.3, 0.2, 60, null, 0.4, 0.3, null), ingredients: ['rice', 'curd'] },
  { id: 'upma', name: 'Upma', aliases: ['rava upma', 'semolina'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(150, 3.5, 22, 5, 1.3, 0.7, 12, null, 0.4, 1, null), ingredients: ['onion', 'carrot'] },
  { id: 'poha', name: 'Poha', aliases: ['aval', 'flattened rice', 'avalakki'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(130, 2.5, 23, 3, 1, 1.5, 8, null, 0.4, 2, null), ingredients: ['onion'] },
  { id: 'dalia', name: 'Dalia', aliases: ['broken wheat porridge'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(85, 3, 16, 1.2, 2.5, 0.9, 15, null, 0.6, 0, null) },
  { id: 'oats', name: 'Oats porridge', aliases: ['oatmeal'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(71, 2.5, 12, 1.5, 1.7, 0.9, 9, 0, 0.6, 0, null) },
  { id: 'bread', name: 'Bread', aliases: ['toast', 'white bread'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 25 }, nutrients: n(265, 8.9, 49, 3.3, 2.7, 1.5, 50, 0, 0.7, 0, null) },
  { id: 'pasta', name: 'Pasta', aliases: ['macaroni'], category: 'cereals', groups: ['carbohydrate'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(158, 5.8, 31, 0.9, 1.8, 0.5, 7, 0, 0.5, 0, null) },

  // Legumes and pulses
  { id: 'dal', name: 'Dal', aliases: ['toor dal', 'paruppu', 'arhar', 'pappu'], category: 'legumes', groups: ['protein'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: { bowls: 150, cups: 200, spoons: 15, ml: 1 }, nutrients: n(95, 5.5, 14, 2, 3.5, 1, 25, null, 0.7, 1, null) },
  { id: 'moong-dal', name: 'Moong dal', aliases: ['green gram', 'pesarapappu'], category: 'legumes', groups: ['protein'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: { bowls: 150, cups: 200, spoons: 15, ml: 1 }, nutrients: n(85, 5.5, 13, 1.5, 3, 1, 20, null, 0.6, 1, null) },
  { id: 'urad-dal', name: 'Urad dal', aliases: ['black gram'], category: 'legumes', groups: ['protein'], defaultUnit: 'spoons', defaultQty: 2, unitGrams: { bowls: 150, cups: 200, spoons: 15 }, nutrients: n(105, 7, 16, 1.5, 4, 1.5, 50, null, 0.9, 1, null) },
  { id: 'sambar', name: 'Sambar', aliases: ['sambhar', 'kuzhambu'], category: 'legumes', groups: ['protein', 'vegetable'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: LIQUID, nutrients: n(65, 3, 9, 2, 2.5, 0.9, 30, null, 0.4, 5, null), ingredients: ['dal', 'tomato', 'onion', 'drumstick'] },
  { id: 'rasam', name: 'Rasam', aliases: ['saaru', 'chaaru'], category: 'legumes', groups: [], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: LIQUID, nutrients: n(30, 1.2, 4, 1, 0.8, 0.4, 12, null, 0.2, 6, null), ingredients: ['tomato', 'dal'] },
  { id: 'chana', name: 'Chickpeas', aliases: ['chana', 'chole', 'kondakadalai', 'sundal'], category: 'legumes', groups: ['protein'], defaultUnit: 'bowls', defaultQty: 0.25, unitGrams: { bowls: 140, cups: 160, spoons: 15 }, nutrients: n(164, 8.9, 27.4, 2.6, 7.6, 2.9, 49, 0, 1.5, 1.3, 0.04) },
  { id: 'rajma', name: 'Rajma', aliases: ['kidney beans'], category: 'legumes', groups: ['protein'], defaultUnit: 'bowls', defaultQty: 0.25, unitGrams: BOWL_COOKED, nutrients: n(110, 6, 16, 2.5, 5, 2, 35, 0, 0.8, 2, null) },
  { id: 'sprouts', name: 'Moong sprouts', aliases: ['sprouts'], category: 'legumes', groups: ['protein', 'vegetable'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: { spoons: 10, cups: 100, bowls: 80 }, nutrients: n(30, 3, 5.9, 0.2, 1.8, 0.9, 13, 0, 0.4, 13.2, null) },

  // Dairy
  { id: 'milk', name: 'Milk', aliases: ['cow milk', 'paal', 'doodh'], category: 'dairy', groups: ['protein'], defaultUnit: 'ml', defaultQty: 150, unitGrams: { ml: 1.03, cups: 206, spoons: 15 }, nutrients: n(61, 3.2, 4.8, 3.3, 0, 0, 113, 0.1, 0.4, 0, 0.08) },
  { id: 'curd', name: 'Curd', aliases: ['yogurt', 'dahi', 'thayir', 'perugu', 'mosaru'], category: 'dairy', groups: ['protein'], defaultUnit: 'spoons', defaultQty: 4, unitGrams: { spoons: 15, cups: 245, bowls: 150 }, nutrients: n(61, 3.5, 4.7, 3.3, 0, 0.1, 121, 0.1, 0.6, 0.5, 0.03) },
  { id: 'paneer', name: 'Paneer', aliases: ['cottage cheese'], category: 'dairy', groups: ['protein', 'fat'], defaultUnit: 'pieces', defaultQty: 4, unitGrams: { pieces: 10, cups: 120, spoons: 12 }, nutrients: n(265, 18.3, 1.2, 20.8, 0, 0.2, 476, null, 2.8, 0, null) },
  { id: 'cheese', name: 'Cheese', aliases: ['cheese slice'], category: 'dairy', groups: ['protein', 'fat'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 20, spoons: 10 }, nutrients: n(330, 18, 4, 27, 0, 0.4, 600, 0.6, 2.5, 0, null) },
  { id: 'buttermilk', name: 'Buttermilk', aliases: ['chaas', 'majjige', 'moru', 'mor'], category: 'beverages', groups: ['protein'], defaultUnit: 'ml', defaultQty: 100, unitGrams: LIQUID, nutrients: n(25, 1.3, 2, 1.1, 0, 0, 50, null, 0.2, 0, null) },
  { id: 'lassi', name: 'Lassi', category: 'beverages', groups: ['protein'], defaultUnit: 'ml', defaultQty: 100, unitGrams: LIQUID, nutrients: n(90, 3, 14, 2.5, 0, 0.1, 100, null, 0.4, 0.5, null) },

  // Protein sources
  { id: 'egg', name: 'Egg', aliases: ['boiled egg', 'mutta', 'anda'], category: 'protein', groups: ['protein', 'fat'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 50 }, nutrients: n(155, 12.6, 1.1, 10.6, 0, 1.2, 50, 2.2, 1.05, 0, 0.07) },
  { id: 'omelette', name: 'Omelette', aliases: ['scrambled egg', 'egg bhurji'], category: 'protein', groups: ['protein', 'fat'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 60, spoons: 15 }, nutrients: n(154, 10.6, 0.6, 11.7, 0, 1.5, 48, 1.8, 1, 0, 0.07), ingredients: ['egg'] },
  { id: 'chicken', name: 'Chicken', aliases: ['chicken curry', 'kozhi', 'murgh'], category: 'protein', groups: ['protein'], defaultUnit: 'pieces', defaultQty: 2, unitGrams: { pieces: 30, bowls: 120, spoons: 15 }, nutrients: n(190, 27, 0, 8, 0, 1.2, 15, 0.1, 2, 0, 0.06) },
  { id: 'fish', name: 'Fish', aliases: ['meen', 'machli', 'rohu'], category: 'protein', groups: ['protein'], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 40, bowls: 120, spoons: 15 }, nutrients: n(130, 22, 0, 4.5, 0, 0.7, 30, null, 0.6, 0, 0.5) },
  { id: 'tofu', name: 'Tofu', category: 'protein', groups: ['protein'], defaultUnit: 'pieces', defaultQty: 3, unitGrams: { pieces: 15, cups: 250 }, nutrients: n(76, 8, 1.9, 4.8, 0.3, 5.4, 350, 0, 0.8, 0.1, 0.3) },

  // Fruits
  { id: 'banana', name: 'Banana', aliases: ['vazhaipazham', 'kela', 'arati'], category: 'fruits', groups: ['fruit'], defaultUnit: 'pieces', defaultQty: 0.5, unitGrams: { pieces: 90, ...FRUIT_PIECES }, nutrients: n(89, 1.1, 22.8, 0.3, 2.6, 0.3, 5, 0, 0.15, 8.7, 0.03) },
  { id: 'papaya', name: 'Papaya', aliases: ['papita', 'boppayi'], category: 'fruits', groups: ['fruit'], defaultUnit: 'cups', defaultQty: 0.5, unitGrams: { pieces: 15, ...FRUIT_PIECES }, nutrients: n(43, 0.5, 10.8, 0.3, 1.7, 0.25, 20, 0, 0.08, 60.9, null) },
  { id: 'apple', name: 'Apple', aliases: ['seb'], category: 'fruits', groups: ['fruit'], defaultUnit: 'pieces', defaultQty: 0.5, unitGrams: { pieces: 150, ...FRUIT_PIECES }, nutrients: n(52, 0.3, 13.8, 0.2, 2.4, 0.1, 6, 0, 0.04, 4.6, 0.01) },
  { id: 'mango', name: 'Mango', aliases: ['aam', 'mampazham'], category: 'fruits', groups: ['fruit'], defaultUnit: 'cups', defaultQty: 0.5, unitGrams: { pieces: 200, ...FRUIT_PIECES }, nutrients: n(60, 0.8, 15, 0.4, 1.6, 0.16, 11, 0, 0.09, 36.4, null) },
  { id: 'orange', name: 'Orange', aliases: ['mosambi', 'santra'], category: 'fruits', groups: ['fruit'], defaultUnit: 'pieces', defaultQty: 0.5, unitGrams: { pieces: 130, ...FRUIT_PIECES }, nutrients: n(47, 0.9, 11.8, 0.1, 2.4, 0.1, 40, 0, 0.07, 53.2, null) },
  { id: 'guava', name: 'Guava', aliases: ['amrood', 'koyya', 'jama'], category: 'fruits', groups: ['fruit'], defaultUnit: 'pieces', defaultQty: 0.5, unitGrams: { pieces: 100, ...FRUIT_PIECES }, nutrients: n(68, 2.6, 14.3, 1, 5.4, 0.26, 18, 0, 0.23, 228, null) },
  { id: 'grapes', name: 'Grapes (halved)', aliases: ['grapes', 'angoor'], category: 'fruits', groups: ['fruit'], defaultUnit: 'pieces', defaultQty: 8, unitGrams: { pieces: 5, ...FRUIT_PIECES }, nutrients: n(69, 0.7, 18, 0.2, 0.9, 0.36, 10, 0, 0.07, 3.2, null) },
  { id: 'pomegranate', name: 'Pomegranate', aliases: ['anar', 'madhulai'], category: 'fruits', groups: ['fruit'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: { spoons: 12, cups: 170, bowls: 120 }, nutrients: n(83, 1.7, 18.7, 1.2, 4, 0.3, 10, 0, 0.35, 10.2, null) },
  { id: 'watermelon', name: 'Watermelon', aliases: ['tarbooz'], category: 'fruits', groups: ['fruit'], defaultUnit: 'cups', defaultQty: 0.5, unitGrams: { pieces: 20, ...FRUIT_PIECES }, nutrients: n(30, 0.6, 7.6, 0.2, 0.4, 0.24, 7, 0, 0.1, 8.1, null) },
  { id: 'chikoo', name: 'Chikoo', aliases: ['sapota', 'sapodilla'], category: 'fruits', groups: ['fruit'], defaultUnit: 'pieces', defaultQty: 0.5, unitGrams: { pieces: 70, ...FRUIT_PIECES }, nutrients: n(83, 0.4, 20, 1.1, 5.3, 0.8, 21, 0, 0.1, 14.7, null) },
  { id: 'pear', name: 'Pear', aliases: ['nashpati'], category: 'fruits', groups: ['fruit'], defaultUnit: 'pieces', defaultQty: 0.5, unitGrams: { pieces: 170, ...FRUIT_PIECES }, nutrients: n(57, 0.4, 15.2, 0.1, 3.1, 0.18, 9, 0, 0.1, 4.3, null) },
  { id: 'dates', name: 'Dates', aliases: ['khajur', 'pericham pazham'], category: 'fruits', groups: ['fruit'], defaultUnit: 'pieces', defaultQty: 2, unitGrams: { pieces: 8 }, nutrients: n(282, 2.5, 75, 0.4, 8, 1, 39, 0, 0.3, 0.4, null) },
  { id: 'raisins', name: 'Raisins', aliases: ['kishmish', 'dry grapes'], category: 'fruits', groups: ['fruit'], defaultUnit: 'spoons', defaultQty: 1, unitGrams: { spoons: 10, pieces: 0.5 }, nutrients: n(299, 3.1, 79, 0.5, 3.7, 1.9, 50, 0, 0.2, 2.3, null) },
  { id: 'avocado', name: 'Avocado', aliases: ['butter fruit'], category: 'fruits', groups: ['fruit', 'fat'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: { spoons: 15, pieces: 150, cups: 150 }, nutrients: n(160, 2, 8.5, 14.7, 6.7, 0.6, 12, 0, 0.6, 10, 0.11) },

  // Vegetables
  { id: 'carrot', name: 'Carrot', aliases: ['gajar'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: { pieces: 60, ...VEG_COOKED }, nutrients: n(35, 0.8, 8.2, 0.2, 3, 0.34, 30, 0, 0.2, 3.6, null) },
  { id: 'spinach', name: 'Spinach', aliases: ['palak', 'keerai', 'greens', 'palakura'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: VEG_COOKED, nutrients: n(23, 3, 3.8, 0.3, 2.4, 3.6, 136, 0, 0.76, 9.8, 0.1) },
  { id: 'beans', name: 'Beans', aliases: ['green beans', 'french beans'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: VEG_COOKED, nutrients: n(35, 1.9, 7.9, 0.3, 3.2, 0.65, 44, 0, 0.25, 9.7, null) },
  { id: 'sweet-potato', name: 'Sweet potato', aliases: ['shakarkandi', 'sakkaraivalli'], category: 'vegetables', groups: ['vegetable', 'carbohydrate'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: { pieces: 100, ...VEG_COOKED }, nutrients: n(76, 1.4, 17.7, 0.1, 2.5, 0.7, 27, 0, 0.2, 12.8, null) },
  { id: 'potato', name: 'Potato', aliases: ['aloo', 'urulai'], category: 'vegetables', groups: ['vegetable', 'carbohydrate'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: { pieces: 100, ...VEG_COOKED }, nutrients: n(87, 1.9, 20, 0.1, 1.8, 0.3, 5, 0, 0.3, 13, null) },
  { id: 'tomato', name: 'Tomato', aliases: ['thakkali', 'tamatar'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 2, unitGrams: { pieces: 90, ...VEG_COOKED }, nutrients: n(18, 0.9, 3.9, 0.2, 1.2, 0.27, 10, 0, 0.17, 13.7, null) },
  { id: 'cucumber', name: 'Cucumber', aliases: ['kheera'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'pieces', defaultQty: 4, unitGrams: { pieces: 8, ...VEG_COOKED }, nutrients: n(15, 0.7, 3.6, 0.1, 0.5, 0.28, 16, 0, 0.2, 2.8, null) },
  { id: 'peas', name: 'Green peas', aliases: ['matar', 'peas'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 2, unitGrams: VEG_COOKED, nutrients: n(84, 5.4, 15.6, 0.2, 5.5, 1.5, 27, 0, 1.2, 14.2, null) },
  { id: 'pumpkin', name: 'Pumpkin', aliases: ['kaddu', 'parangikai'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: VEG_COOKED, nutrients: n(20, 0.7, 4.9, 0.1, 1.1, 0.57, 15, 0, 0.23, 4.7, null) },
  { id: 'bottle-gourd', name: 'Bottle gourd', aliases: ['lauki', 'sorakaya', 'surakkai'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: VEG_COOKED, nutrients: n(15, 0.6, 3.7, 0, 1.2, 0.25, 24, 0, 0.7, 8.5, null) },
  { id: 'beetroot', name: 'Beetroot', aliases: ['chukandar'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 2, unitGrams: VEG_COOKED, nutrients: n(44, 1.7, 10, 0.2, 2, 0.79, 16, 0, 0.35, 3.6, null) },
  { id: 'cauliflower', name: 'Cauliflower', aliases: ['gobi'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: { pieces: 15, ...VEG_COOKED }, nutrients: n(23, 1.8, 4.1, 0.5, 2.3, 0.32, 16, 0, 0.17, 44.3, null) },
  { id: 'broccoli', name: 'Broccoli', category: 'vegetables', groups: ['vegetable'], defaultUnit: 'pieces', defaultQty: 3, unitGrams: { pieces: 12, ...VEG_COOKED }, nutrients: n(35, 2.4, 7.2, 0.4, 3.3, 0.67, 40, 0, 0.45, 64.9, 0.12) },
  { id: 'drumstick', name: 'Drumstick', aliases: ['moringa', 'murungakkai'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'pieces', defaultQty: 2, unitGrams: { pieces: 10, ...VEG_COOKED }, nutrients: n(37, 2.1, 8.5, 0.2, 3.2, 0.36, 30, 0, 0.45, 141, null) },
  { id: 'onion', name: 'Onion', aliases: ['pyaz', 'vengayam'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 1, unitGrams: { pieces: 70, ...VEG_COOKED }, nutrients: n(40, 1.1, 9.3, 0.1, 1.7, 0.21, 23, 0, 0.17, 7.4, null) },
  { id: 'mixed-veg', name: 'Mixed vegetable curry', aliases: ['poriyal', 'sabzi', 'thoran', 'palya', 'kootu'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'spoons', defaultQty: 3, unitGrams: VEG_COOKED, nutrients: n(70, 2, 8, 3.5, 3, 0.8, 30, null, 0.4, 10, null) },
  { id: 'veg-soup', name: 'Vegetable soup', aliases: ['tomato soup', 'clear soup'], category: 'vegetables', groups: ['vegetable'], defaultUnit: 'cups', defaultQty: 0.5, unitGrams: LIQUID, nutrients: n(30, 1, 5, 0.8, 0.8, 0.4, 12, null, 0.2, 6, null) },

  // Healthy fats
  { id: 'ghee', name: 'Ghee', aliases: ['clarified butter', 'neyyi', 'nei'], category: 'fats', groups: ['fat'], defaultUnit: 'spoons', defaultQty: 0.5, unitGrams: { spoons: 5 }, nutrients: n(900, 0, 0, 99.5, 0, 0, 0, null, 0, 0, null) },
  { id: 'butter', name: 'Butter', aliases: ['makhan', 'vennai'], category: 'fats', groups: ['fat'], defaultUnit: 'spoons', defaultQty: 0.5, unitGrams: { spoons: 5 }, nutrients: n(717, 0.9, 0.1, 81, 0, 0, 24, null, 0.1, 0, null) },
  { id: 'peanut-butter', name: 'Peanut butter', category: 'fats', groups: ['fat', 'protein'], defaultUnit: 'spoons', defaultQty: 0.5, unitGrams: { spoons: 16 }, nutrients: n(588, 25, 20, 50, 6, 1.9, 43, 0, 2.9, 0, 0) },
  { id: 'almonds', name: 'Almonds (powdered or soaked)', aliases: ['badam', 'almond'], category: 'fats', groups: ['fat', 'protein'], defaultUnit: 'pieces', defaultQty: 4, unitGrams: { pieces: 1.2, spoons: 7 }, nutrients: n(579, 21, 22, 50, 12.5, 3.7, 269, 0, 3.1, 0, 0) },
  { id: 'walnuts', name: 'Walnuts (powdered)', aliases: ['akhrot', 'walnut'], category: 'fats', groups: ['fat'], defaultUnit: 'pieces', defaultQty: 2, unitGrams: { pieces: 2, spoons: 7 }, nutrients: n(654, 15, 14, 65, 6.7, 2.9, 98, 0, 3.1, 1.3, 9.1) },
  { id: 'flaxseed', name: 'Flaxseed powder', aliases: ['alsi', 'linseed'], category: 'fats', groups: ['fat'], defaultUnit: 'spoons', defaultQty: 0.5, unitGrams: { spoons: 7 }, nutrients: n(534, 18, 29, 42, 27, 5.7, 255, 0, 4.3, 0.6, 22.8) },
  { id: 'coconut', name: 'Coconut (fresh)', aliases: ['thengai', 'nariyal', 'grated coconut'], category: 'fats', groups: ['fat'], defaultUnit: 'spoons', defaultQty: 1, unitGrams: { spoons: 8, cups: 80 }, nutrients: n(354, 3.3, 15, 33, 9, 2.4, 14, 0, 1.1, 3.3, 0) },
  { id: 'coconut-chutney', name: 'Coconut chutney', aliases: ['chutney'], category: 'fats', groups: ['fat'], defaultUnit: 'spoons', defaultQty: 2, unitGrams: { spoons: 15, bowls: 100 }, nutrients: n(180, 2.5, 8, 16, 4.5, 1, 15, null, 0.6, 2, null), ingredients: ['coconut'] },

  // Snacks and processed foods
  { id: 'biscuits', name: 'Biscuits', aliases: ['cookies', 'marie', 'glucose biscuit'], category: 'snacks', groups: ['carbohydrate'], defaultUnit: 'pieces', defaultQty: 2, unitGrams: { pieces: 6 }, nutrients: n(450, 7, 75, 14, 1.5, null, null, null, null, 0, null) },
  { id: 'chips', name: 'Chips', aliases: ['crisps', 'wafers'], category: 'snacks', groups: [], defaultUnit: 'pieces', defaultQty: 5, unitGrams: { pieces: 2, cups: 20 }, nutrients: n(536, 7, 53, 35, 4.4, 1.6, 24, 0, 1.1, null, null) },
  { id: 'namkeen', name: 'Namkeen / murukku', aliases: ['murukku', 'mixture', 'chakli'], category: 'snacks', groups: [], defaultUnit: 'pieces', defaultQty: 2, unitGrams: { pieces: 10, cups: 40 }, nutrients: n(520, 9, 55, 30, 4, null, null, null, null, 0, null) },
  { id: 'cake', name: 'Cake', aliases: ['muffin', 'cupcake'], category: 'snacks', groups: [], defaultUnit: 'pieces', defaultQty: 1, unitGrams: { pieces: 40 }, nutrients: n(380, 5, 55, 16, 1, null, null, null, null, 0, null) },
  { id: 'chocolate', name: 'Chocolate', category: 'snacks', groups: [], defaultUnit: 'pieces', defaultQty: 2, unitGrams: { pieces: 5 }, nutrients: n(535, 7.7, 59, 30, 3.4, 2.4, 189, null, 2.3, 0, null) },
  { id: 'ice-cream', name: 'Ice cream', category: 'snacks', groups: [], defaultUnit: 'spoons', defaultQty: 4, unitGrams: { spoons: 15, cups: 130 }, nutrients: n(207, 3.5, 23.6, 11, 0.7, 0.1, 128, null, 0.7, 0.6, null) },
  { id: 'noodles', name: 'Instant noodles', aliases: ['maggi', 'noodles'], category: 'snacks', groups: ['carbohydrate'], defaultUnit: 'bowls', defaultQty: 0.5, unitGrams: BOWL_COOKED, nutrients: n(140, 3.3, 19, 5.5, 0.9, null, null, null, null, 0, null) },
  { id: 'makhana', name: 'Makhana (roasted)', aliases: ['fox nuts', 'lotus seeds'], category: 'snacks', groups: ['carbohydrate'], defaultUnit: 'cups', defaultQty: 0.25, unitGrams: { cups: 32, pieces: 0.4 }, nutrients: n(350, 9.7, 77, 0.1, null, 1.4, 60, 0, null, 0, null) },
  { id: 'mithai', name: 'Indian sweet (mithai)', aliases: ['laddoo', 'halwa', 'payasam', 'kheer', 'sweet'], category: 'snacks', groups: [], defaultUnit: 'pieces', defaultQty: 1, unitGrams: {}, nutrients: n(null, null, null, null, null, null, null, null, null, null, null) },

  // Beverages
  { id: 'coconut-water', name: 'Coconut water', aliases: ['elaneer', 'nariyal pani'], category: 'beverages', groups: [], defaultUnit: 'ml', defaultQty: 100, unitGrams: LIQUID, nutrients: n(19, 0.7, 3.7, 0.2, 1.1, 0.29, 24, 0, 0.1, 2.4, 0) },
  { id: 'fresh-juice', name: 'Fresh fruit juice', aliases: ['orange juice', 'juice'], category: 'beverages', groups: [], defaultUnit: 'ml', defaultQty: 100, unitGrams: LIQUID, nutrients: n(45, 0.7, 10.4, 0.2, 0.2, 0.2, 11, 0, 0.05, 50, null) },
  { id: 'packaged-juice', name: 'Packaged juice', aliases: ['fruit drink', 'tetra pack'], category: 'beverages', groups: [], defaultUnit: 'ml', defaultQty: 100, unitGrams: LIQUID, nutrients: n(45, 0.2, 11, 0.1, 0.2, null, null, null, null, null, null) },
]

/**
 * Where each food's nutrient values come from.
 *
 * - `ifct`: one IFCT 2017 food, per 100 g edible portion (raw composition; cooking losses of
 *   heat-sensitive vitamins are not modelled).
 * - `recipe`: a standard home recipe calculated from IFCT 2017 ingredients. `parts` are raw
 *   ingredient grams and `cooked` is the weight of the finished dish they make (water absorbed or
 *   added), so values are per 100 g of the dish as eaten.
 * - Foods not listed (packaged and processed foods, and a few not in IFCT 2017) keep the
 *   approximate values above and are shown as estimates.
 */
type Composition = { ifct: string } | { parts: [string, number][]; cooked: number }

const COMPOSITION: Record<string, Composition> = {
  // Cereals — cooked weights are typical home yields
  rice: { parts: [['A015', 100]], cooked: 300 },
  idli: { parts: [['A015', 67], ['B003', 33]], cooked: 210 },
  dosa: { parts: [['A015', 67], ['B003', 33], ['T005', 8]], cooked: 190 },
  uttapam: { parts: [['A015', 67], ['B003', 33], ['T005', 8], ['G017', 15], ['D075', 15]], cooked: 220 },
  chapati: { parts: [['A019', 100], ['T013', 3]], cooked: 150 },
  paratha: { parts: [['A019', 100], ['T013', 15]], cooked: 165 },
  'ragi-flour': { ifct: 'A010' },
  'ragi-porridge': { parts: [['A010', 15], ['L002', 100]], cooked: 175 },
  pongal: { parts: [['A015', 60], ['B010', 30], ['T013', 8]], cooked: 300 },
  khichdi: { parts: [['A015', 60], ['B010', 40], ['T013', 5]], cooked: 350 },
  'curd-rice': { parts: [['A015', 30], ['L002', 60]], cooked: 150 },
  upma: { parts: [['A022', 50], ['T005', 5], ['G017', 10]], cooked: 180 },
  poha: { parts: [['A011', 50], ['T005', 5], ['G017', 10], ['H012', 5]], cooked: 130 },
  dalia: { parts: [['A021', 30]], cooked: 150 },
  // Legumes
  dal: { parts: [['B021', 30], ['T013', 2]], cooked: 150 },
  'moong-dal': { parts: [['B010', 30], ['T013', 2]], cooked: 150 },
  'urad-dal': { parts: [['B003', 30]], cooked: 120 },
  sambar: { parts: [['B021', 15], ['D046', 10], ['D075', 10], ['G017', 10], ['T005', 3]], cooked: 180 },
  rasam: { parts: [['B021', 5], ['D075', 30]], cooked: 150 },
  chana: { parts: [['B002', 40]], cooked: 100 },
  rajma: { parts: [['B020', 40]], cooked: 100 },
  // Dairy and protein foods (curd taken as whole cow milk; IFCT 2017 has no curd entry)
  milk: { ifct: 'L002' },
  curd: { parts: [['L002', 100]], cooked: 100 },
  paneer: { ifct: 'L003' },
  egg: { ifct: 'M004' },
  omelette: { parts: [['M007', 100]], cooked: 100 },
  chicken: { parts: [['N001', 100]], cooked: 75 },
  fish: { parts: [['S006', 100]], cooked: 80 },
  // Fruits
  banana: { ifct: 'E012' },
  papaya: { ifct: 'E049' },
  apple: { ifct: 'E001' },
  mango: { ifct: 'E036' },
  orange: { ifct: 'E047' },
  guava: { ifct: 'E028' },
  grapes: { ifct: 'E026' },
  pomegranate: { ifct: 'E055' },
  watermelon: { ifct: 'E065' },
  chikoo: { ifct: 'E060' },
  pear: { ifct: 'E051' },
  dates: { ifct: 'E017' },
  raisins: { ifct: 'E057' },
  avocado: { ifct: 'E007' },
  // Vegetables
  carrot: { ifct: 'F002' },
  spinach: { ifct: 'C033' },
  beans: { ifct: 'D050' },
  'sweet-potato': { ifct: 'F014' },
  potato: { ifct: 'F006' },
  tomato: { ifct: 'D075' },
  cucumber: { ifct: 'D043' },
  peas: { ifct: 'D061' },
  pumpkin: { ifct: 'D066' },
  'bottle-gourd': { ifct: 'D007' },
  beetroot: { ifct: 'F001' },
  cauliflower: { ifct: 'D036' },
  drumstick: { ifct: 'D046' },
  onion: { ifct: 'G017' },
  'mixed-veg': { parts: [['F002', 30], ['D050', 30], ['D061', 20], ['F006', 20], ['T005', 4]], cooked: 104 },
  'veg-soup': { parts: [['D075', 40], ['F002', 20], ['G017', 10]], cooked: 150 },
  // Fats, nuts and seeds
  ghee: { ifct: 'T013' },
  almonds: { ifct: 'H001' },
  walnuts: { ifct: 'H021' },
  flaxseed: { ifct: 'H014' },
  coconut: { ifct: 'H007' },
  'coconut-chutney': { parts: [['H007', 40], ['B001', 10], ['T005', 2]], cooked: 100 },
  'coconut-water': { ifct: 'K002' },
}

function compose(composition: Composition): Nutrients {
  if ('ifct' in composition) return { ...IFCT[composition.ifct].nutrients }
  const result = {} as Nutrients
  for (const key of NUTRIENT_KEYS) {
    let total: number | null = 0
    for (const [code, grams] of composition.parts) {
      const value = IFCT[code].nutrients[key]
      total = value == null || total == null ? null : total + (value * grams) / 100
    }
    result[key] = total == null ? null : Math.round((total / composition.cooked) * 100 * 1000) / 1000
  }
  return result
}

export type CompositionSource = 'ifct' | 'recipe' | 'estimate'

/** Apply IFCT-derived values; returns the catalogue with each food's composition source. */
for (const food of FOOD_CATALOG) {
  const composition = COMPOSITION[food.id]
  if (!composition) {
    food.source = 'estimate'
    continue
  }
  food.nutrients = compose(composition)
  food.source = 'ifct' in composition ? 'ifct' : 'recipe'
  food.compositionNote =
    'ifct' in composition
      ? `IFCT 2017 ${composition.ifct}: ${IFCT[composition.ifct].name}`
      : `Recipe from IFCT 2017: ${composition.parts.map(([code, grams]) => `${grams} g ${IFCT[code].name.toLowerCase()}`).join(', ')} → ${composition.cooked} g cooked`
}

export const CATALOG_IDS = new Set(FOOD_CATALOG.map((food) => food.id))
