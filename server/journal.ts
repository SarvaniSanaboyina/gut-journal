import type { Meal, Mood, Poop, Prisma, PrismaClient } from '@prisma/client'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'HttpError'
  }
}

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
const PHOTO_SLOTS = ['before', 'after'] as const

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
  notes: string
  hasBeforePhoto: boolean
  hasAfterPhoto: boolean
}

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
  notes: string
}

export type MoodEntry = {
  id: string
  date: string
  time: string
  mood: (typeof MOODS)[number]
  notes: string
}

export type JournalData = {
  meals: MealEntry[]
  poops: PoopEntry[]
  moods: MoodEntry[]
  dayNotes: Record<string, string>
}

type Db = PrismaClient | Prisma.TransactionClient

const MAX_ENTRIES = 10000
const MAX_TEXT = 4000
const MAX_NOTE = 8000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function bad(message: string): never {
  throw new HttpError(400, message)
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  return bad(`Invalid ${label}`)
}

function parseId(value: unknown, fallbackNew = false): string {
  if (typeof value !== 'string' || value.trim() === '') {
    if (fallbackNew) return crypto.randomUUID()
    return bad('Invalid id')
  }
  if (!/^[0-9a-zA-Z-]{1,80}$/.test(value)) return bad('Invalid id')
  return value
}

function parseDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return bad('Invalid date')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return bad('Invalid date')
  }
  return value
}

function parseTime(value: unknown, optional = false): string {
  if (optional && (value === '' || value == null)) return ''
  if (typeof value !== 'string') return bad('Invalid time')
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return bad('Invalid time')
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = match[3] == null ? null : Number(match[3])
  if (hour > 23 || minute > 59 || (second != null && second > 59)) return bad('Invalid time')
  const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return second == null ? clock : `${clock}:${String(second).padStart(2, '0')}`
}

function parseText(value: unknown, max: number): string {
  if (value == null) return ''
  if (typeof value !== 'string') return bad('Invalid text')
  const text = value.trim()
  if (text.length > max) return bad('Text is too long')
  return text
}

function parseFlag(value: unknown): boolean {
  return value === true
}

function parseQuantity(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(number) || number < 0 || number > 100000) return bad('Invalid quantity')
  return number
}

function migrateMealType(type: string): MealEntry['type'] {
  if (type === 'snack') return 'morning-snack'
  if (type === 'drink') return 'mini-snack'
  if ((MEAL_TYPES as readonly string[]).includes(type)) return type as MealEntry['type']
  return 'mini-snack'
}

function mealFromRow(row: Meal): MealEntry {
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
    notes: row.notes,
    hasBeforePhoto: row.hasBeforePhoto === true,
    hasAfterPhoto: row.hasAfterPhoto === true,
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
  const foods = parseText(value.foods, MAX_TEXT)
  if (!foods) return bad('A meal needs a description of what he ate')
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
    notes: parseText(value.notes, MAX_TEXT),
    hasBeforePhoto: parseFlag(value.hasBeforePhoto),
    hasAfterPhoto: parseFlag(value.hasAfterPhoto),
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

function photoBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (Buffer.isBuffer(value)) return new Uint8Array(value)
  if (typeof value === 'string' && value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex')
  return bad('Could not read a stored photo')
}

export function parsePhotoSlot(value: string): PhotoSlot {
  if (value === 'before' || value === 'after') return value
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
    notes: meal.notes,
    hasBeforePhoto: meal.hasBeforePhoto,
    hasAfterPhoto: meal.hasAfterPhoto,
  }
  return db.meal.upsert({
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
      notes: data.notes,
      hasBeforePhoto: data.hasBeforePhoto,
      hasAfterPhoto: data.hasAfterPhoto,
    },
  })
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

async function insertPhoto(db: Db, mealId: string, slot: PhotoSlot, mime: string, bytes: Uint8Array) {
  const payload = Buffer.from(bytes)
  await db.mealPhoto.upsert({
    where: { mealId_slot: { mealId, slot } },
    create: { mealId, slot, mime, bytes: payload },
    update: { mime, bytes: payload },
  })
  if (slot === 'before') {
    await db.meal.updateMany({ where: { id: mealId }, data: { hasBeforePhoto: true } })
  } else {
    await db.meal.updateMany({ where: { id: mealId }, data: { hasAfterPhoto: true } })
  }
}

export async function readJournal(db: PrismaClient): Promise<JournalData> {
  const [meals, poops, moods, notes] = await Promise.all([
    db.meal.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }] }),
    db.poop.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }] }),
    db.mood.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }] }),
    db.dayNote.findMany({ orderBy: { date: 'asc' } }),
  ])
  const dayNotes: Record<string, string> = {}
  for (const row of notes) dayNotes[row.date] = row.note
  return {
    meals: meals.map(mealFromRow),
    poops: poops.map(poopFromRow),
    moods: moods.map(moodFromRow),
    dayNotes,
  }
}

export async function saveMeal(db: PrismaClient, body: unknown) {
  const meal = parseMeal(body)
  const saved = await insertMeal(db, meal)
  return mealFromRow(saved)
}

export async function removeMeal(db: PrismaClient, id: string) {
  const mealId = parseId(id)
  await db.$transaction([
    db.mealPhoto.deleteMany({ where: { mealId } }),
    db.meal.deleteMany({ where: { id: mealId } }),
  ])
}

export async function savePoop(db: PrismaClient, body: unknown) {
  const entry = parsePoop(body)
  await insertPoop(db, entry)
  return entry
}

export async function removePoop(db: PrismaClient, id: string) {
  await db.poop.deleteMany({ where: { id: parseId(id) } })
}

export async function saveMood(db: PrismaClient, body: unknown) {
  const entry = parseMood(body)
  await insertMood(db, entry)
  return entry
}

export async function removeMood(db: PrismaClient, id: string) {
  await db.mood.deleteMany({ where: { id: parseId(id) } })
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
    if (slot === 'before') {
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
  if (mealsRaw.length > MAX_ENTRIES || poopsRaw.length > MAX_ENTRIES || moodsRaw.length > MAX_ENTRIES) {
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
  const poops = poopsRaw.map((item) => parsePoop(item, true))
  const moods = moodsRaw.map((item) => parseMood(item, true))
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
    await tx.dayNote.deleteMany()
    for (const meal of meals) await insertMeal(tx, meal)
    for (const entry of poops) await insertPoop(tx, entry)
    for (const entry of moods) await insertMood(tx, entry)
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
  for (const row of photos) {
    const extra = byMeal.get(row.mealId) ?? {}
    const url = `data:${row.mime};base64,${Buffer.from(photoBytes(row.bytes)).toString('base64')}`
    if (row.slot === 'before') extra.photoBefore = url
    else extra.photoAfter = url
    byMeal.set(row.mealId, extra)
  }
  return {
    ...journal,
    meals: journal.meals.map((meal) => ({ ...meal, ...byMeal.get(meal.id) })),
  }
}
