export type MealType =
  | 'breakfast'
  | 'morning-snack'
  | 'lunch'
  | 'evening-snack'
  | 'dinner'
  | 'mini-snack'

export type MealConsistency = 'solid' | 'semi-solid' | 'liquid'

export type QuantityUnit = 'bites' | 'spoons' | 'pieces' | 'bowls' | 'cups' | 'ml'

export interface MealEntry {
  id: string
  date: string
  time: string
  endTime: string
  type: MealType
  foods: string
  quantity: number | null
  quantityUnit: QuantityUnit
  consistency: MealConsistency
  consistencyPercent: number | null
  calories: number | null
  notes: string
  hasBeforePhoto: boolean
  hasAfterPhoto: boolean
  source: MealSource
  items: MealItem[]
}

export type MealSource = '' | 'homemade' | 'packaged' | 'restaurant'

export type FoodCategory =
  | 'cereals'
  | 'fruits'
  | 'vegetables'
  | 'dairy'
  | 'protein'
  | 'legumes'
  | 'fats'
  | 'snacks'
  | 'beverages'

export type FoodGroup = 'carbohydrate' | 'protein' | 'vegetable' | 'fruit' | 'fat'

export type FoodUnit = 'g' | 'ml' | 'pieces' | 'cups' | 'bowls' | 'spoons'

export type NutrientKey =
  | 'energyKcal'
  | 'proteinG'
  | 'carbsG'
  | 'fatG'
  | 'fibreG'
  | 'ironMg'
  | 'calciumMg'
  | 'vitaminDUg'
  | 'zincMg'
  | 'vitaminCMg'
  | 'omega3G'

/** Per 100 g. `null` = unknown, never zero. */
export type Nutrients = Record<NutrientKey, number | null>

/** `catalogue` = estimated from food composition tables, `label` = copied from a pack label by a parent. */
export type NutrientSource = 'ifct' | 'recipe' | 'catalogue' | 'label' | 'none'

export interface FoodEntry {
  id: string
  name: string
  aliases: string[]
  category: FoodCategory
  groups: FoodGroup[]
  defaultUnit: FoodUnit
  defaultQty: number | null
  unitGrams: Partial<Record<Exclude<FoodUnit, 'g'>, number>>
  nutrients: Nutrients
  nutrientSource: NutrientSource
  /** Where the values come from (IFCT code, recipe, label). */
  sourceNote: string
  ingredients: string[]
  isCustom: boolean
}

export interface MealIngredient {
  id: string
  foodId: string | null
  name: string
  quantityServed: number | null
  quantityConsumed: number | null
  unit: FoodUnit
  consumedPercent: number | null
  preparation: string
  notes: string
}

export interface MealItem extends MealIngredient {
  ingredients: MealIngredient[]
}

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type PoopConsistency = 'hard' | 'soft' | 'watery'

export type StoolColor =
  | 'brown'
  | 'yellow'
  | 'green'
  | 'black'
  | 'red'
  | 'pale'
  | 'other'

export type StoolAmount = 'small' | 'medium' | 'large'

export interface PoopEntry {
  id: string
  date: string
  time: string
  bristol: BristolType
  color: StoolColor
  amount: StoolAmount
  straining: boolean
  pain: boolean
  mucus: boolean
  visibleBlood: boolean
  hasPhoto: boolean
  notes: string
}

export type SymptomType =
  | 'bloating'
  | 'gas'
  | 'stomach-pain'
  | 'constipation'
  | 'loose-stools'
  | 'diarrhoea'
  | 'vomiting'
  | 'acid-reflux'
  | 'other'

export type Severity = 'mild' | 'moderate' | 'severe'

export interface ReactionEntry {
  id: string
  foodId: string | null
  mealId: string | null
  foodName: string
  consumedDate: string
  consumedTime: string
  severity: Severity
  previousSimilar: 'yes' | 'no' | 'unsure'
  notes: string
}

export interface SymptomEntry {
  id: string
  date: string
  time: string
  type: SymptomType
  otherLabel: string
  severity: Severity
  durationMinutes: number | null
  notes: string
  reactions: ReactionEntry[]
}

export type Level = '' | 'low' | 'normal' | 'high'

export interface DailyMetricEntry {
  date: string
  appetite: Level
  energy: Level
  sleepHours: number | null
  digestionNotes: string
}

export type MoodKind =
  | 'happy'
  | 'calm'
  | 'fussy'
  | 'tired'
  | 'irritable'
  | 'energetic'
  | 'tummy'

export interface MoodEntry {
  id: string
  date: string
  time: string
  mood: MoodKind
  notes: string
}

export type WaterUnit = 'ml' | 'sips' | 'cups'

export interface WaterEntry {
  id: string
  date: string
  time: string
  amount: number
  unit: WaterUnit
  notes: string
}

export interface JournalData {
  meals: MealEntry[]
  poops: PoopEntry[]
  moods: MoodEntry[]
  waters: WaterEntry[]
  dayNotes: Record<string, string>
  foods: FoodEntry[]
  symptoms: SymptomEntry[]
  dailyMetrics: DailyMetricEntry[]
  growth: GrowthEntry[]
  mealSlots: MealSlotEntry[]
  settings: Settings
}

/** The five scheduled meals every day ("Other" meals are extra and not a slot). */
export type SlotType = 'breakfast' | 'morning-snack' | 'lunch' | 'evening-snack' | 'dinner'
export type SlotStatus = 'not-logged' | 'eaten' | 'not-eaten'

/** Stored only for an explicit "not eaten"; "eaten" comes from meal entries. */
export interface MealSlotEntry {
  date: string
  mealType: SlotType
  status: 'not-eaten'
  note: string
}

/** Portion-share bands used by the "share of served food eaten" report metric (not the calendar). */
export interface CalendarThresholds {
  lessBelow: number
  moreAbove: number
}

/** Overrides for the daily nutrition assessment; missing fields use the defaults. */
export type NutritionAssessmentSettings = Partial<{
  lowPercent: number
  energyHighPercent: number
  aboveRecommendedPercent: number
  minCoveragePercent: number
  belowSharePercent: number
  keyNutrients: NutrientKey[]
}>

export type MeasurePosition = '' | 'lying' | 'standing'

export interface GrowthEntry {
  id: string
  date: string
  weightKg: number | null
  heightCm: number | null
  /** Lying length (under 2 years) or standing height (2 years and over), per WHO measurement practice. */
  position: MeasurePosition
  notes: string
}

export interface ChildProfile {
  sex: '' | 'female' | 'male'
  birthDate: string
}

export interface Settings {
  childProfile: ChildProfile
  nutrientReferences: { custom: Partial<Record<NutrientKey, number>> }
  nutritionAssessment: NutritionAssessmentSettings
}

export const emptyJournal = (): JournalData => ({
  meals: [],
  poops: [],
  moods: [],
  waters: [],
  dayNotes: {},
  foods: [],
  symptoms: [],
  dailyMetrics: [],
  growth: [],
  mealSlots: [],
  settings: { childProfile: { sex: '', birthDate: '' }, nutrientReferences: { custom: {} }, nutritionAssessment: {} },
})
