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
  notes: string
  hasBeforePhoto: boolean
  hasAfterPhoto: boolean
}

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7

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
  notes: string
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

export interface JournalData {
  meals: MealEntry[]
  poops: PoopEntry[]
  moods: MoodEntry[]
  dayNotes: Record<string, string>
}

export const emptyJournal = (): JournalData => ({
  meals: [],
  poops: [],
  moods: [],
  dayNotes: {},
})
