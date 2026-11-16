import type {
  BristolType,
  MealConsistency,
  MealType,
  MoodKind,
  PoopConsistency,
  QuantityUnit,
  StoolAmount,
  StoolColor,
} from './types'

export const APP_NAME = 'Journal'
export const BIRTH_DATE_MIN = '1990-01-01'

export function journalTitle(name?: string | null) {
  const trimmed = name?.trim()
  if (!trimmed) return APP_NAME
  return `${trimmed}'s journal`
}

export const MEAL_TYPES: {
  id: MealType
  label: string
  hint: string
}[] = [
  { id: 'breakfast', label: 'Breakfast', hint: 'Morning meal' },
  { id: 'morning-snack', label: 'Morning snack', hint: 'After breakfast' },
  { id: 'lunch', label: 'Lunch', hint: 'Midday meal' },
  { id: 'evening-snack', label: 'Evening snack', hint: 'After lunch' },
  { id: 'dinner', label: 'Dinner', hint: 'Evening meal' },
  { id: 'mini-snack', label: 'Mini snack', hint: 'A little extra' },
]

export const MEAL_CONSISTENCIES: {
  id: MealConsistency
  label: string
  hint: string
}[] = [
  { id: 'solid', label: 'Solids', hint: 'Finger foods, chunks' },
  { id: 'semi-solid', label: 'Semi-solid', hint: 'Mashed, porridge, khichdi' },
  { id: 'liquid', label: 'Liquids', hint: 'Milk, water, soup, juice' },
]

export const QUANTITY_UNITS: { id: QuantityUnit; label: string }[] = [
  { id: 'bites', label: 'Bites' },
  { id: 'spoons', label: 'Spoons' },
  { id: 'pieces', label: 'Pieces' },
  { id: 'bowls', label: 'Bowls' },
  { id: 'cups', label: 'Cups' },
  { id: 'ml', label: 'ml' },
]

export const POOP_CONSISTENCIES: {
  id: PoopConsistency
  label: string
  hint: string
  bristol: BristolType
}[] = [
  { id: 'hard', label: 'Hard', hint: 'Pellets or lumpy', bristol: 2 },
  { id: 'soft', label: 'Soft', hint: 'Smooth and formed', bristol: 4 },
  { id: 'watery', label: 'Watery', hint: 'Loose or liquid', bristol: 7 },
]

export const STOOL_COLORS: { id: StoolColor; label: string; swatch: string; alert?: boolean }[] = [
  { id: 'brown', label: 'Brown', swatch: '#8B5A2B' },
  { id: 'yellow', label: 'Yellow', swatch: '#D4A017' },
  { id: 'green', label: 'Green', swatch: '#6B8F4E' },
  { id: 'pale', label: 'Pale / clay', swatch: '#D9C7A3', alert: true },
  { id: 'black', label: 'Black', swatch: '#2B2118', alert: true },
  { id: 'red', label: 'Red / blood', swatch: '#A33B2B', alert: true },
  { id: 'other', label: 'Other', swatch: '#C4B5A5' },
]

export const STOOL_AMOUNTS: { id: StoolAmount; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
]

export const MOODS: {
  id: MoodKind
  label: string
  caption: string
}[] = [
  { id: 'happy', label: 'Happy', caption: 'Smiley, easy' },
  { id: 'calm', label: 'Calm', caption: 'Settled' },
  { id: 'energetic', label: 'Energetic', caption: 'On the go' },
  { id: 'fussy', label: 'Fussy', caption: 'Hard to soothe' },
  { id: 'irritable', label: 'Irritable', caption: 'Easily upset' },
  { id: 'tired', label: 'Tired', caption: 'Low energy' },
  { id: 'tummy', label: 'Tummy ache', caption: 'Uncomfortable' },
]

export function mealLabel(type: MealType): string {
  return MEAL_TYPES.find((item) => item.id === type)?.label ?? type
}

export function poopConsistency(type: BristolType): PoopConsistency {
  if (type <= 2) return 'hard'
  if (type >= 6) return 'watery'
  return 'soft'
}

export function poopConsistencyMeta(type: BristolType) {
  const id = poopConsistency(type)
  return POOP_CONSISTENCIES.find((item) => item.id === id)!
}

export function moodMeta(mood: MoodKind) {
  return MOODS.find((item) => item.id === mood)!
}

export function stoolColorMeta(color: StoolColor) {
  return STOOL_COLORS.find((item) => item.id === color)!
}
