import type {
  BristolType,
  MealConsistency,
  MealType,
  MoodKind,
  QuantityUnit,
  StoolAmount,
  StoolColor,
} from './types'

export const CHILD_NAME = 'Ashrit'
export const APP_NAME = `${CHILD_NAME}'s Gut Journal`

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

export const BRISTOL: {
  type: BristolType
  title: string
  hint: string
  tone: 'constipated' | 'ideal' | 'loose'
}[] = [
  { type: 1, title: 'Hard pellets', hint: 'Separate lumps, like nuts', tone: 'constipated' },
  { type: 2, title: 'Lumpy sausage', hint: 'Sausage-shaped, lumpy', tone: 'constipated' },
  { type: 3, title: 'Cracked sausage', hint: 'Sausage with cracks on the surface', tone: 'ideal' },
  { type: 4, title: 'Smooth sausage', hint: 'Soft, smooth, and easy to pass', tone: 'ideal' },
  { type: 5, title: 'Soft blobs', hint: 'Soft pieces with clear edges', tone: 'loose' },
  { type: 6, title: 'Mushy', hint: 'Fluffy, mushy pieces', tone: 'loose' },
  { type: 7, title: 'Watery', hint: 'Entirely liquid, no pieces', tone: 'loose' },
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

export function bristolMeta(type: BristolType) {
  return BRISTOL.find((item) => item.type === type)!
}

export function moodMeta(mood: MoodKind) {
  return MOODS.find((item) => item.id === mood)!
}

export function stoolColorMeta(color: StoolColor) {
  return STOOL_COLORS.find((item) => item.id === color)!
}
