import type { Meal, MealItem, Mood, Poop, PrismaClient, Water } from '@prisma/client'
import { FOOD_UNITS, type FoodUnit } from './foodCatalog.ts'
import { type FoodEntry, listFoods, parseCustomFood, upsertCustomFood } from './foods.ts'
import {
  type DailyMetricEntry,
  insertMetric,
  insertSymptom,
  parseMetric,
  parseSymptom,
  readGut,
  type SymptomEntry,
} from './gut.ts'
import {
  bad,
  type Db,
  isRecord,
  MAX_NOTE,
  MAX_TEXT,
  oneOf,
  parseDate,
  parseFlag,
  parseId,
  parseOptionalNumber,
  parseQuantity,
  parseText,
  parseTime,
  recordRevision,
} from './validate.ts'

export { HttpError } from './validate.ts'

const MEAL_TYPES = [
  'breakfast',
  'morning-snack',
  'lunch',
  'evening-snack',
  'dinner',
  'mini-snack',
] as const

const CONSISTENCIES = ['solid', 'semi-solid', 'liquid'] as const
const QUANTITY_UNITS = ['bites', 'spoons', 'pieces', 'bowls', 'cups', 'ml'] as const
const COLORS = ['brown', 'yellow', 'green', 'black', 'red', 'pale', 'other'] as const
const AMOUNTS = ['small', 'medium', 'large'] as const
const MOODS = ['happy', 'calm', 'fussy', 'tired', 'irritable', 'energetic', 'tummy'] as const
const WATER_UNITS = ['ml', 'sips', 'cups'] as const
const PHOTO_SLOTS = ['before', 'after', 'stool'] as const
const MEAL_SOURCES = ['', 'homemade', 'packaged', 'restaurant'] as const
const MAX_ITEMS = 40
const MAX_INGREDIENTS = 20

export type PhotoSlot = (typeof PHOTO_SLOTS)[number]

export type MealEntry = {
  id: string
  date: string
  time: string
  endTime: string
  type: (typeof MEAL_TYPES)[number]
  foods: string
  quantity: number | null
  quantityUnit: (typeof QUANTITY_UNITS)[number]
  consistency: (typeof CONSISTENCIES)[number]
  consistencyPercent: number | null
  calories: number | null
  notes: string
  hasBeforePhoto: boolean
  hasAfterPhoto: boolean
  source: (typeof MEAL_SOURCES)[number]
  items: MealItemEntry[]
}

export type MealIngredientEntry = {
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

export type MealItemEntry = MealIngredientEntry & { ingredients: MealIngredientEntry[] }

export type PoopEntry = {
  id: string
  date: string
  time: string
  bristol: number
  color: (typeof COLORS)[number]
  amount: (typeof AMOUNTS)[number]
  straining: boolean
  pain: boolean
  mucus: boolean
  visibleBlood: boolean
  hasPhoto: boolean
  notes: string
}

export type MoodEntry = {
  id: string
  date: string
  time: string
  mood: (typeof MOODS)[number]
  notes: string
}

export type WaterEntry = {
  id: string
  date: string
  time: string
  amount: number
  unit: (typeof WATER_UNITS)[number]
  notes: string
}

export type JournalData = {
  meals: MealEntry[]
  poops: PoopEntry[]
  moods: MoodEntry[]
  waters: WaterEntry[]
  dayNotes: Record<string, string>
  foods: FoodEntry[]
  symptoms: SymptomEntry[]
  dailyMetrics: DailyMetricEntry[]
}

const MAX_ENTRIES = 10000

function migrateMealType(type: string): MealEntry['type'] {
  if (type === 'snack') return 'morning-snack'
  if (type === 'drink') return 'mini-snack'
  if ((MEAL_TYPES as readonly string[]).includes(type)) return type as MealEntry['type']
  return 'mini-snack'
}

type MealRow = Meal & { items?: MealItem[] }

function ingredientFromRow(row: MealItem): MealIngredientEntry {
  return {
    id: row.id,
    foodId: row.foodItemId,
    name: row.foodName,
    quantityServed: row.quantityServed == null ? null : Number(row.quantityServed),
    quantityConsumed: row.quantityConsumed == null ? null : Number(row.quantityConsumed),
    unit: row.unit as FoodUnit,
    consumedPercent: row.consumedPercent == null ? null : Number(row.consumedPercent),
    preparation: row.preparation,
    notes: row.notes,
  }
}

function itemsFromRows(rows: MealItem[]): MealItemEntry[] {
  const sorted = [...rows].sort((a, b) => a.position - b.position)
  return sorted
    .filter((row) => !row.parentItemId)
    .map((row) => ({
      ...ingredientFromRow(row),
      ingredients: sorted.filter((child) => child.parentItemId === row.id).map(ingredientFromRow),
    }))
}

function mealFromRow(row: MealRow): MealEntry {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    endTime: row.endTime,
    type: row.type as MealEntry['type'],
    foods: row.foods,
    quantity: row.quantity == null ? null : Number(row.quantity),
    quantityUnit: row.quantityUnit as MealEntry['quantityUnit'],
    consistency: row.consistency as MealEntry['consistency'],
    consistencyPercent: row.consistencyPercent == null ? null : Number(row.consistencyPercent),
    calories: row.calories == null ? null : Number(row.calories),
    notes: row.notes,
    hasBeforePhoto: row.hasBeforePhoto === true,
    hasAfterPhoto: row.hasAfterPhoto === true,
    source: (MEAL_SOURCES as readonly string[]).includes(row.source) ? (row.source as MealEntry['source']) : '',
    items: itemsFromRows(row.items ?? []),
  }
}

function poopFromRow(row: Poop): PoopEntry {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    bristol: Number(row.bristol),
    color: row.color as PoopEntry['color'],
    amount: row.amount as PoopEntry['amount'],
    straining: row.straining === true,
    pain: row.pain === true,
    mucus: row.mucus === true,
    visibleBlood: row.visibleBlood === true,
    hasPhoto: row.hasPhoto === true,
    notes: row.notes,
  }
}

function moodFromRow(row: Mood): MoodEntry {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    mood: row.mood as MoodEntry['mood'],
    notes: row.notes,
  }
}

function waterFromRow(row: Water): WaterEntry {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    amount: Number(row.amount),
    unit: row.unit as WaterEntry['unit'],
    notes: row.notes,
  }
}

function parseIngredient(value: unknown, loose: boolean): MealIngredientEntry {
  if (!isRecord(value)) return bad('Invalid food in meal')
  const name = parseText(value.name, 120)
  if (!name) return bad('Each food needs a name')
  const quantityServed = parseOptionalNumber(value.quantityServed, 'quantity served', 5000)
  const quantityConsumed = parseOptionalNumber(value.quantityConsumed, 'quantity eaten', 5000)
  let consumedPercent = parseOptionalNumber(value.consumedPercent, 'amount eaten', 100)
  if (quantityServed != null && quantityConsumed != null) {
    if (quantityConsumed > quantityServed + 1e-9) {
      return bad(`${name}: eaten cannot be more than served. Add second helpings to the amount served.`)
    }
    // Keep a tapped quick-choice (e.g. 75%) unless the typed amounts clearly disagree with it.
    const derived = quantityServed > 0 ? (quantityConsumed / quantityServed) * 100 : consumedPercent
    if (derived != null && (consumedPercent == null || Math.abs(derived - consumedPercent) > 2)) consumedPercent = derived
  }
  const foodId = value.foodId == null || value.foodId === '' ? null : parseId(value.foodId)
  return {
    id: parseId(value.id, loose),
    foodId,
    name,
    quantityServed,
    quantityConsumed,
    unit: oneOf(typeof value.unit === 'string' ? value.unit : 'pieces', FOOD_UNITS, 'unit'),
    consumedPercent: consumedPercent == null ? null : Math.round(consumedPercent),
    preparation: parseText(value.preparation, 120),
    notes: parseText(value.notes, MAX_TEXT),
  }
}

function parseItems(value: unknown, loose: boolean): MealItemEntry[] {
  if (value == null) return []
  if (!Array.isArray(value)) return bad('Invalid meal foods')
  if (value.length > MAX_ITEMS) return bad('Too many foods in one meal')
  const items = value.map((raw) => {
    const item = parseIngredient(raw, loose)
    const rawIngredients = isRecord(raw) && Array.isArray(raw.ingredients) ? raw.ingredients : []
    if (rawIngredients.length > MAX_INGREDIENTS) return bad('Too many ingredients for one food')
    return { ...item, ingredients: rawIngredients.map((child) => parseIngredient(child, loose)) }
  })
  const ids = items.flatMap((item) => [item.id, ...item.ingredients.map((child) => child.id)])
  if (new Set(ids).size !== ids.length) return bad('Duplicate food in meal')
  return items
}

function parseMeal(value: unknown, looseType = false): MealEntry {
  if (!isRecord(value)) return bad('Invalid meal')
  const consistency = oneOf(
    typeof value.consistency === 'string' ? value.consistency : 'solid',
    CONSISTENCIES,
    'consistency',
  )
  const percent = parseQuantity(value.consistencyPercent)
  const typeSource = typeof value.type === 'string' ? value.type : 'mini-snack'
  const type = looseType ? migrateMealType(typeSource) : oneOf(typeSource, MEAL_TYPES, 'meal type')
  const items = parseItems(value.items, looseType)
  const foods = parseText(value.foods, MAX_TEXT) || items.map((item) => item.name).join(', ')
  if (!foods) return bad('Add at least one food to the meal')
  return {
    id: parseId(value.id, looseType),
    date: parseDate(value.date),
    time: parseTime(value.time),
    endTime: parseTime(value.endTime, true),
    type,
    foods,
    quantity: parseQuantity(value.quantity),
    quantityUnit: oneOf(
      typeof value.quantityUnit === 'string' ? value.quantityUnit : 'spoons',
      QUANTITY_UNITS,
      'quantity unit',
    ),
    consistency,
    consistencyPercent:
      consistency === 'semi-solid' && percent != null
        ? Math.min(100, Math.max(0, Math.round(percent)))
        : null,
    calories: parseQuantity(value.calories),
    notes: parseText(value.notes, MAX_TEXT),
    hasBeforePhoto: parseFlag(value.hasBeforePhoto),
    hasAfterPhoto: parseFlag(value.hasAfterPhoto),
    source: oneOf(typeof value.source === 'string' ? value.source : '', MEAL_SOURCES, 'meal source'),
    items,
  }
}

function parsePoop(value: unknown, loose = false): PoopEntry {
  if (!isRecord(value)) return bad('Invalid poop log')
  const bristol = Number(value.bristol)
  if (!Number.isInteger(bristol) || bristol < 1 || bristol > 7) return bad('Invalid Bristol type')
  return {
    id: parseId(value.id, loose),
    date: parseDate(value.date),
    time: parseTime(value.time),
    bristol,
    color: oneOf(typeof value.color === 'string' ? value.color : 'brown', COLORS, 'color'),
    amount: oneOf(typeof value.amount === 'string' ? value.amount : 'medium', AMOUNTS, 'amount'),
    straining: parseFlag(value.straining),
    pain: parseFlag(value.pain),
    mucus: parseFlag(value.mucus),
    visibleBlood: parseFlag(value.visibleBlood),
    hasPhoto: parseFlag(value.hasPhoto),
    notes: parseText(value.notes, MAX_TEXT),
  }
}

function parseMood(value: unknown, loose = false): MoodEntry {
  if (!isRecord(value)) return bad('Invalid mood log')
  return {
    id: parseId(value.id, loose),
    date: parseDate(value.date),
    time: parseTime(value.time),
    mood: oneOf(typeof value.mood === 'string' ? value.mood : 'calm', MOODS, 'mood'),
    notes: parseText(value.notes, MAX_TEXT),
  }
}

function parseWater(value: unknown, loose = false): WaterEntry {
  if (!isRecord(value)) return bad('Invalid water log')
  const amount = parseQuantity(value.amount)
  if (amount == null || amount <= 0) return bad('A water log needs an amount')
  return {
    id: parseId(value.id, loose),
    date: parseDate(value.date),
    time: parseTime(value.time),
    amount,
    unit: oneOf(typeof value.unit === 'string' ? value.unit : 'ml', WATER_UNITS, 'water unit'),
    notes: parseText(value.notes, MAX_TEXT),
  }
}

function photoBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (Buffer.isBuffer(value)) return new Uint8Array(value)
  if (typeof value === 'string' && value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex')
  return bad('Could not read a stored photo')
}

export function parsePhotoSlot(value: string): PhotoSlot {
  if (value === 'before' || value === 'after' || value === 'stool') return value
  return bad('Invalid photo')
}

function parseDataUrl(value: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(value)
  if (!match) return bad('A backup photo is not a valid image')
  const mime = match[1].toLowerCase()
  if (!mime.startsWith('image/') || mime === 'image/svg+xml') return bad('A backup photo is not a supported image')
  return { mime, bytes: new Uint8Array(Buffer.from(match[2].replace(/\s/g, ''), 'base64')) }
}

async function insertMeal(db: Db, meal: MealEntry) {
  const data = {
    id: meal.id,
    date: meal.date,
    time: meal.time,
    endTime: meal.endTime,
    type: meal.type,
    foods: meal.foods,
    quantity: meal.quantity,
    quantityUnit: meal.quantityUnit,
    consistency: meal.consistency,
    consistencyPercent: meal.consistencyPercent,
    calories: meal.calories,
    notes: meal.notes,
    hasBeforePhoto: meal.hasBeforePhoto,
    hasAfterPhoto: meal.hasAfterPhoto,
    source: meal.source,
  }
  await db.meal.upsert({
    where: { id: meal.id },
    create: data,
    update: {
      date: data.date,
      time: data.time,
      endTime: data.endTime,
      type: data.type,
      foods: data.foods,
      quantity: data.quantity,
      quantityUnit: data.quantityUnit,
      consistency: data.consistency,
      consistencyPercent: data.consistencyPercent,
      calories: data.calories,
      notes: data.notes,
      hasBeforePhoto: data.hasBeforePhoto,
      hasAfterPhoto: data.hasAfterPhoto,
      source: data.source,
    },
  })
  await db.mealItem.deleteMany({ where: { mealId: meal.id } })
  const knownFoods = new Set(
    (await db.foodItem.findMany({
      where: { id: { in: meal.items.flatMap((item) => [item.foodId, ...item.ingredients.map((child) => child.foodId)]).filter((id): id is string => id != null) } },
      select: { id: true },
    })).map((row) => row.id),
  )
  const row = (item: MealIngredientEntry, position: number, parentItemId: string | null) => ({
    id: item.id,
    mealId: meal.id,
    parentItemId,
    // A food deleted from the catalogue keeps its name snapshot on the meal.
    foodItemId: item.foodId && knownFoods.has(item.foodId) ? item.foodId : null,
    foodName: item.name,
    quantityServed: item.quantityServed,
    quantityConsumed: item.quantityConsumed,
    unit: item.unit,
    consumedPercent: item.consumedPercent,
    preparation: item.preparation,
    notes: item.notes,
    position,
  })
  const parents = meal.items.map((item, index) => row(item, index, null))
  const children = meal.items.flatMap((item) => item.ingredients.map((child, index) => row(child, index, item.id)))
  if (parents.length) await db.mealItem.createMany({ data: parents })
  if (children.length) await db.mealItem.createMany({ data: children })
  const saved = await db.meal.findUniqueOrThrow({ where: { id: meal.id }, include: { items: true } })
  return mealFromRow(saved)
}

async function insertPoop(db: Db, entry: PoopEntry) {
  const data = {
    id: entry.id,
    date: entry.date,
    time: entry.time,
    bristol: entry.bristol,
    color: entry.color,
    amount: entry.amount,
    straining: entry.straining,
    pain: entry.pain,
    mucus: entry.mucus,
    visibleBlood: entry.visibleBlood,
    hasPhoto: entry.hasPhoto,
    notes: entry.notes,
  }
  await db.poop.upsert({
    where: { id: entry.id },
    create: data,
    update: {
      date: data.date,
      time: data.time,
      bristol: data.bristol,
      color: data.color,
      amount: data.amount,
      straining: data.straining,
      pain: data.pain,
      mucus: data.mucus,
      visibleBlood: data.visibleBlood,
      hasPhoto: data.hasPhoto,
      notes: data.notes,
    },
  })
}

async function insertMood(db: Db, entry: MoodEntry) {
  const data = {
    id: entry.id,
    date: entry.date,
    time: entry.time,
    mood: entry.mood,
    notes: entry.notes,
  }
  await db.mood.upsert({
    where: { id: entry.id },
    create: data,
    update: {
      date: data.date,
      time: data.time,
      mood: data.mood,
      notes: data.notes,
    },
  })
}

async function insertWater(db: Db, entry: WaterEntry) {
  const data = {
    id: entry.id,
    date: entry.date,
    time: entry.time,
    amount: entry.amount,
    unit: entry.unit,
    notes: entry.notes,
  }
  await db.water.upsert({
    where: { id: entry.id },
    create: data,
    update: {
      date: data.date,
      time: data.time,
      amount: data.amount,
      unit: data.unit,
      notes: data.notes,
    },
  })
}

async function insertPhoto(db: Db, mealId: string, slot: PhotoSlot, mime: string, bytes: Uint8Array) {
  const payload = Buffer.from(bytes)
  await db.mealPhoto.upsert({
    where: { mealId_slot: { mealId, slot } },
    create: { mealId, slot, mime, bytes: payload },
    update: { mime, bytes: payload },
  })
  if (slot === 'stool') {
    await db.poop.updateMany({ where: { id: mealId }, data: { hasPhoto: true } })
  } else if (slot === 'before') {
    await db.meal.updateMany({ where: { id: mealId }, data: { hasBeforePhoto: true } })
  } else {
    await db.meal.updateMany({ where: { id: mealId }, data: { hasAfterPhoto: true } })
  }
}

export async function readJournal(db: PrismaClient): Promise<JournalData> {
  const [meals, poops, moods, waters, notes] = await Promise.all([
    db.meal.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }], include: { items: true } }),
    db.poop.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }] }),
    db.mood.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }] }),
    db.water.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }] }),
    db.dayNote.findMany({ orderBy: { date: 'asc' } }),
  ])
  const foods = await listFoods(db)
  const gut = await readGut(db)
  const dayNotes: Record<string, string> = {}
  for (const row of notes) dayNotes[row.date] = row.note
  return {
    meals: meals.map(mealFromRow),
    poops: poops.map(poopFromRow),
    moods: moods.map(moodFromRow),
    waters: waters.map(waterFromRow),
    dayNotes,
    foods,
    ...gut,
  }
}

export async function saveMeal(db: PrismaClient, body: unknown) {
  const meal = parseMeal(body)
  return db.$transaction(async (tx) => {
    const existing = await tx.meal.findUnique({ where: { id: meal.id }, include: { items: true } })
    if (existing) await recordRevision(tx, 'meal', meal.id, 'update', mealFromRow(existing))
    return insertMeal(tx, meal)
  })
}

export async function removeMeal(db: PrismaClient, id: string) {
  const mealId = parseId(id)
  await db.$transaction(async (tx) => {
    const existing = await tx.meal.findUnique({ where: { id: mealId }, include: { items: true } })
    if (existing) await recordRevision(tx, 'meal', mealId, 'delete', mealFromRow(existing))
    await tx.mealPhoto.deleteMany({ where: { mealId } })
    await tx.meal.deleteMany({ where: { id: mealId } })
  })
}

export async function savePoop(db: PrismaClient, body: unknown) {
  const entry = parsePoop(body)
  await db.$transaction(async (tx) => {
    const existing = await tx.poop.findUnique({ where: { id: entry.id } })
    if (existing) await recordRevision(tx, 'poop', entry.id, 'update', poopFromRow(existing))
    await insertPoop(tx, entry)
  })
  return entry
}

export async function removePoop(db: PrismaClient, id: string) {
  const poopId = parseId(id)
  await db.$transaction(async (tx) => {
    const existing = await tx.poop.findUnique({ where: { id: poopId } })
    if (existing) await recordRevision(tx, 'poop', poopId, 'delete', poopFromRow(existing))
    await tx.mealPhoto.deleteMany({ where: { mealId: poopId, slot: 'stool' } })
    await tx.poop.deleteMany({ where: { id: poopId } })
  })
}

export async function saveMood(db: PrismaClient, body: unknown) {
  const entry = parseMood(body)
  await db.$transaction(async (tx) => {
    const existing = await tx.mood.findUnique({ where: { id: entry.id } })
    if (existing) await recordRevision(tx, 'mood', entry.id, 'update', moodFromRow(existing))
    await insertMood(tx, entry)
  })
  return entry
}

export async function removeMood(db: PrismaClient, id: string) {
  const moodId = parseId(id)
  await db.$transaction(async (tx) => {
    const existing = await tx.mood.findUnique({ where: { id: moodId } })
    if (existing) await recordRevision(tx, 'mood', moodId, 'delete', moodFromRow(existing))
    await tx.mood.deleteMany({ where: { id: moodId } })
  })
}

export async function saveWater(db: PrismaClient, body: unknown) {
  const entry = parseWater(body)
  await db.$transaction(async (tx) => {
    const existing = await tx.water.findUnique({ where: { id: entry.id } })
    if (existing) await recordRevision(tx, 'water', entry.id, 'update', waterFromRow(existing))
    await insertWater(tx, entry)
  })
  return entry
}

export async function removeWater(db: PrismaClient, id: string) {
  const waterId = parseId(id)
  await db.$transaction(async (tx) => {
    const existing = await tx.water.findUnique({ where: { id: waterId } })
    if (existing) await recordRevision(tx, 'water', waterId, 'delete', waterFromRow(existing))
    await tx.water.deleteMany({ where: { id: waterId } })
  })
}

export async function saveDayNote(db: PrismaClient, dateValue: string, body: unknown) {
  const date = parseDate(dateValue)
  if (!isRecord(body) || typeof body.note !== 'string') return bad('Invalid day note')
  if (body.note.length > MAX_NOTE) return bad('Day note is too long')
  if (body.note.trim() === '') {
    await db.dayNote.deleteMany({ where: { date } })
    return
  }
  await db.dayNote.upsert({
    where: { date },
    create: { date, note: body.note },
    update: { note: body.note },
  })
}

export async function readPhoto(db: PrismaClient, mealId: string, slot: PhotoSlot) {
  const row = await db.mealPhoto.findUnique({
    where: { mealId_slot: { mealId: parseId(mealId), slot } },
  })
  if (!row) return null
  return { mime: row.mime, bytes: photoBytes(row.bytes) }
}

export function checkPhotoMime(mime: string) {
  const type = mime.toLowerCase()
  if (!type.startsWith('image/') || type === 'image/svg+xml') return bad('Photo must be an image')
  return type
}

export async function savePhoto(
  db: PrismaClient,
  mealId: string,
  slot: PhotoSlot,
  mime: string,
  bytes: Uint8Array,
) {
  if (bytes.byteLength === 0) return bad('Photo is empty')
  if (bytes.byteLength > 8_000_000) return bad('Photo is too large')
  await insertPhoto(db, parseId(mealId), slot, checkPhotoMime(mime), bytes)
}

export async function removePhoto(db: PrismaClient, mealId: string, slot: PhotoSlot) {
  const id = parseId(mealId)
  await db.$transaction(async (tx) => {
    await tx.mealPhoto.deleteMany({ where: { mealId: id, slot } })
    if (slot === 'stool') {
      await tx.poop.updateMany({ where: { id }, data: { hasPhoto: false } })
    } else if (slot === 'before') {
      await tx.meal.updateMany({ where: { id }, data: { hasBeforePhoto: false } })
    } else {
      await tx.meal.updateMany({ where: { id }, data: { hasAfterPhoto: false } })
    }
  })
}

type IncomingPhoto = { mealId: string; slot: PhotoSlot; mime: string; bytes: Uint8Array }

function takePhoto(value: unknown, mealId: string, slot: PhotoSlot, photos: IncomingPhoto[]) {
  if (typeof value !== 'string' || value === '') return
  const parsed = parseDataUrl(value)
  photos.push({ mealId, slot, mime: parsed.mime, bytes: parsed.bytes })
}

export async function importJournal(db: PrismaClient, body: unknown): Promise<JournalData> {
  if (!isRecord(body)) return bad('Invalid backup')
  const mealsRaw = Array.isArray(body.meals) ? body.meals : []
  const poopsRaw = Array.isArray(body.poops) ? body.poops : []
  const moodsRaw = Array.isArray(body.moods) ? body.moods : []
  const watersRaw = Array.isArray(body.waters) ? body.waters : []
  if (
    mealsRaw.length > MAX_ENTRIES ||
    poopsRaw.length > MAX_ENTRIES ||
    moodsRaw.length > MAX_ENTRIES ||
    watersRaw.length > MAX_ENTRIES
  ) {
    return bad('Backup has too many entries')
  }

  const photos: IncomingPhoto[] = []
  const meals = mealsRaw.map((item) => {
    const meal = parseMeal(item, true)
    if (isRecord(item)) {
      takePhoto(item.photoBefore, meal.id, 'before', photos)
      takePhoto(item.photoAfter, meal.id, 'after', photos)
    }
    if (photos.some((photo) => photo.mealId === meal.id && photo.slot === 'before')) meal.hasBeforePhoto = true
    if (photos.some((photo) => photo.mealId === meal.id && photo.slot === 'after')) meal.hasAfterPhoto = true
    return meal
  })
  const poops = poopsRaw.map((item) => {
    const entry = parsePoop(item, true)
    if (isRecord(item)) takePhoto(item.photo, entry.id, 'stool', photos)
    entry.hasPhoto = photos.some((photo) => photo.mealId === entry.id && photo.slot === 'stool')
    return entry
  })
  const moods = moodsRaw.map((item) => parseMood(item, true))
  const waters = watersRaw.map((item) => parseWater(item, true))
  const foodsRaw = Array.isArray(body.foods) ? body.foods : []
  if (foodsRaw.length > MAX_ENTRIES) return bad('Backup has too many foods')
  const symptomsRaw = Array.isArray(body.symptoms) ? body.symptoms : []
  const metricsRaw = Array.isArray(body.dailyMetrics) ? body.dailyMetrics : []
  if (symptomsRaw.length > MAX_ENTRIES || metricsRaw.length > MAX_ENTRIES) return bad('Backup has too many entries')
  const symptoms = symptomsRaw.map((item) => parseSymptom(item, true))
  const metrics = metricsRaw.map((item) => parseMetric(item, isRecord(item) ? item.date : null))
  const customFoods = foodsRaw
    .filter((item) => isRecord(item) && item.isCustom === true)
    .map((item) => parseCustomFood(item, true))
  const dayNotes: Record<string, string> = {}
  if (isRecord(body.dayNotes)) {
    for (const [date, note] of Object.entries(body.dayNotes)) {
      if (typeof note !== 'string') continue
      if (note.length > MAX_NOTE) return bad('Day note is too long')
      if (note.trim() === '') continue
      dayNotes[parseDate(date)] = note
    }
  }

  await db.$transaction(async (tx) => {
    await tx.mealPhoto.deleteMany()
    await tx.meal.deleteMany()
    await tx.poop.deleteMany()
    await tx.mood.deleteMany()
    await tx.water.deleteMany()
    await tx.dayNote.deleteMany()
    await tx.symptom.deleteMany()
    await tx.dailyMetric.deleteMany()
    await tx.foodItem.deleteMany({ where: { isCustom: true } })
    for (const food of customFoods) await upsertCustomFood(tx, food)
    for (const meal of meals) await insertMeal(tx, meal)
    for (const entry of poops) await insertPoop(tx, entry)
    for (const entry of symptoms) await insertSymptom(tx, entry)
    for (const entry of metrics) await insertMetric(tx, entry)
    for (const entry of moods) await insertMood(tx, entry)
    for (const entry of waters) await insertWater(tx, entry)
    for (const [date, note] of Object.entries(dayNotes)) {
      await tx.dayNote.create({ data: { date, note } })
    }
    for (const photo of photos) await insertPhoto(tx, photo.mealId, photo.slot, photo.mime, photo.bytes)
  })

  return readJournal(db)
}

export async function exportJournal(db: PrismaClient) {
  const journal = await readJournal(db)
  const photos = await db.mealPhoto.findMany()
  const byMeal = new Map<string, { photoBefore?: string; photoAfter?: string }>()
  const stoolPhotos = new Map<string, string>()
  for (const row of photos) {
    const extra = byMeal.get(row.mealId) ?? {}
    const url = `data:${row.mime};base64,${Buffer.from(photoBytes(row.bytes)).toString('base64')}`
    if (row.slot === 'stool') {
      stoolPhotos.set(row.mealId, url)
      continue
    }
    if (row.slot === 'before') extra.photoBefore = url
    else extra.photoAfter = url
    byMeal.set(row.mealId, extra)
  }
  return {
    ...journal,
    meals: journal.meals.map((meal) => ({ ...meal, ...byMeal.get(meal.id) })),
    poops: journal.poops.map((entry) => ({ ...entry, photo: stoolPhotos.get(entry.id) })),
    // Built-in foods are re-seeded on boot; a backup only needs the family's own foods.
    foods: journal.foods.filter((food) => food.isCustom),
  }
}
