import type { DailyMetric, FoodReaction, PrismaClient, Symptom } from '@prisma/client'
import {
  bad,
  type Db,
  isRecord,
  MAX_TEXT,
  oneOf,
  parseDate,
  parseId,
  parseOptionalNumber,
  parseText,
  parseTime,
  recordRevision,
} from './validate.ts'

export const SYMPTOM_TYPES = [
  'bloating',
  'gas',
  'stomach-pain',
  'constipation',
  'loose-stools',
  'diarrhoea',
  'vomiting',
  'acid-reflux',
  'other',
] as const
export const SEVERITIES = ['mild', 'moderate', 'severe'] as const
const PREVIOUS = ['yes', 'no', 'unsure'] as const
const LEVELS = ['', 'low', 'normal', 'high'] as const
const MAX_REACTIONS = 20

export type ReactionEntry = {
  id: string
  foodId: string | null
  mealId: string | null
  foodName: string
  consumedDate: string
  consumedTime: string
  severity: (typeof SEVERITIES)[number]
  previousSimilar: (typeof PREVIOUS)[number]
  notes: string
}

export type SymptomEntry = {
  id: string
  date: string
  time: string
  type: (typeof SYMPTOM_TYPES)[number]
  otherLabel: string
  severity: (typeof SEVERITIES)[number]
  durationMinutes: number | null
  notes: string
  reactions: ReactionEntry[]
}

export type DailyMetricEntry = {
  date: string
  appetite: (typeof LEVELS)[number]
  energy: (typeof LEVELS)[number]
  sleepHours: number | null
  digestionNotes: string
}

type SymptomRow = Symptom & { reactions?: FoodReaction[] }

function reactionFromRow(row: FoodReaction): ReactionEntry {
  return {
    id: row.id,
    foodId: row.foodItemId,
    mealId: row.mealId,
    foodName: row.foodName,
    consumedDate: row.consumedDate,
    consumedTime: row.consumedTime,
    severity: row.severity as ReactionEntry['severity'],
    previousSimilar: row.previousSimilar as ReactionEntry['previousSimilar'],
    notes: row.notes,
  }
}

export function symptomFromRow(row: SymptomRow): SymptomEntry {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    type: row.type as SymptomEntry['type'],
    otherLabel: row.otherLabel,
    severity: row.severity as SymptomEntry['severity'],
    durationMinutes: row.durationMinutes == null ? null : Number(row.durationMinutes),
    notes: row.notes,
    reactions: (row.reactions ?? []).map(reactionFromRow).sort((a, b) => a.foodName.localeCompare(b.foodName)),
  }
}

export function metricFromRow(row: DailyMetric): DailyMetricEntry {
  return {
    date: row.date,
    appetite: row.appetite as DailyMetricEntry['appetite'],
    energy: row.energy as DailyMetricEntry['energy'],
    sleepHours: row.sleepHours == null ? null : Number(row.sleepHours),
    digestionNotes: row.digestionNotes,
  }
}

function parseReaction(value: unknown, symptom: { date: string; time: string; severity: SymptomEntry['severity'] }, loose: boolean): ReactionEntry {
  if (!isRecord(value)) return bad('Invalid suspected food')
  const foodName = parseText(value.foodName, 120)
  if (!foodName) return bad('A suspected food needs a name')
  const consumedDate = parseDate(value.consumedDate)
  const consumedTime = parseTime(value.consumedTime)
  if (`${consumedDate}T${consumedTime}` > `${symptom.date}T${symptom.time}`) {
    return bad(`${foodName} was eaten after the symptom started`)
  }
  return {
    id: parseId(value.id, loose),
    foodId: value.foodId == null || value.foodId === '' ? null : parseId(value.foodId),
    mealId: value.mealId == null || value.mealId === '' ? null : parseId(value.mealId),
    foodName,
    consumedDate,
    consumedTime,
    severity: oneOf(typeof value.severity === 'string' ? value.severity : symptom.severity, SEVERITIES, 'severity'),
    previousSimilar: oneOf(typeof value.previousSimilar === 'string' ? value.previousSimilar : 'unsure', PREVIOUS, 'previous reaction'),
    notes: parseText(value.notes, MAX_TEXT),
  }
}

export function parseSymptom(value: unknown, loose = false): SymptomEntry {
  if (!isRecord(value)) return bad('Invalid symptom')
  const type = oneOf(typeof value.type === 'string' ? value.type : '', SYMPTOM_TYPES, 'symptom')
  const otherLabel = parseText(value.otherLabel, 80)
  if (type === 'other' && !otherLabel) return bad('Describe the other symptom')
  const duration = parseOptionalNumber(value.durationMinutes, 'duration', 10080)
  const base = {
    id: parseId(value.id, loose),
    date: parseDate(value.date),
    time: parseTime(value.time),
    type,
    otherLabel: type === 'other' ? otherLabel : '',
    severity: oneOf(typeof value.severity === 'string' ? value.severity : 'mild', SEVERITIES, 'severity'),
    durationMinutes: duration == null ? null : Math.round(duration),
    notes: parseText(value.notes, MAX_TEXT),
  }
  const raw = value.reactions == null ? [] : value.reactions
  if (!Array.isArray(raw)) return bad('Invalid suspected foods')
  if (raw.length > MAX_REACTIONS) return bad('Too many suspected foods')
  const reactions = raw.map((item) => parseReaction(item, base, loose))
  if (new Set(reactions.map((item) => item.id)).size !== reactions.length) return bad('Duplicate suspected food')
  return { ...base, reactions }
}

export function parseMetric(value: unknown, dateValue: unknown): DailyMetricEntry {
  if (!isRecord(value)) return bad('Invalid daily check-in')
  return {
    date: parseDate(dateValue),
    appetite: oneOf(typeof value.appetite === 'string' ? value.appetite : '', LEVELS, 'appetite'),
    energy: oneOf(typeof value.energy === 'string' ? value.energy : '', LEVELS, 'energy level'),
    sleepHours: parseOptionalNumber(value.sleepHours, 'sleep hours', 24),
    digestionNotes: parseText(value.digestionNotes, MAX_TEXT),
  }
}

export async function insertSymptom(db: Db, entry: SymptomEntry) {
  const data = {
    date: entry.date,
    time: entry.time,
    type: entry.type,
    otherLabel: entry.otherLabel,
    severity: entry.severity,
    durationMinutes: entry.durationMinutes,
    notes: entry.notes,
  }
  await db.symptom.upsert({ where: { id: entry.id }, create: { id: entry.id, ...data }, update: data })
  await db.foodReaction.deleteMany({ where: { symptomId: entry.id } })
  if (!entry.reactions.length) return
  const foodIds = entry.reactions.map((item) => item.foodId).filter((id): id is string => id != null)
  const mealIds = entry.reactions.map((item) => item.mealId).filter((id): id is string => id != null)
  const knownFoods = new Set((await db.foodItem.findMany({ where: { id: { in: foodIds } }, select: { id: true } })).map((row) => row.id))
  const knownMeals = new Set((await db.meal.findMany({ where: { id: { in: mealIds } }, select: { id: true } })).map((row) => row.id))
  await db.foodReaction.createMany({
    data: entry.reactions.map((item) => ({
      id: item.id,
      symptomId: entry.id,
      foodItemId: item.foodId && knownFoods.has(item.foodId) ? item.foodId : null,
      mealId: item.mealId && knownMeals.has(item.mealId) ? item.mealId : null,
      foodName: item.foodName,
      consumedDate: item.consumedDate,
      consumedTime: item.consumedTime,
      severity: item.severity,
      previousSimilar: item.previousSimilar,
      notes: item.notes,
    })),
  })
}

export async function insertMetric(db: Db, entry: DailyMetricEntry) {
  const empty = !entry.appetite && !entry.energy && entry.sleepHours == null && !entry.digestionNotes
  if (empty) {
    await db.dailyMetric.deleteMany({ where: { date: entry.date } })
    return
  }
  const { date, ...data } = entry
  await db.dailyMetric.upsert({ where: { date }, create: { date, ...data }, update: data })
}

export async function readGut(db: Db) {
  const [symptoms, metrics] = await Promise.all([
    db.symptom.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }], include: { reactions: true } }),
    db.dailyMetric.findMany({ orderBy: { date: 'asc' } }),
  ])
  return { symptoms: symptoms.map(symptomFromRow), dailyMetrics: metrics.map(metricFromRow) }
}

export async function saveSymptom(db: PrismaClient, body: unknown) {
  const entry = parseSymptom(body)
  return db.$transaction(async (tx) => {
    const existing = await tx.symptom.findUnique({ where: { id: entry.id }, include: { reactions: true } })
    if (existing) await recordRevision(tx, 'symptom', entry.id, 'update', symptomFromRow(existing))
    await insertSymptom(tx, entry)
    return symptomFromRow(await tx.symptom.findUniqueOrThrow({ where: { id: entry.id }, include: { reactions: true } }))
  })
}

export async function removeSymptom(db: PrismaClient, idValue: string) {
  const id = parseId(idValue)
  await db.$transaction(async (tx) => {
    const existing = await tx.symptom.findUnique({ where: { id }, include: { reactions: true } })
    if (existing) await recordRevision(tx, 'symptom', id, 'delete', symptomFromRow(existing))
    await tx.symptom.deleteMany({ where: { id } })
  })
}

export async function saveMetric(db: PrismaClient, dateValue: string, body: unknown) {
  const entry = parseMetric(body, dateValue)
  await db.$transaction(async (tx) => {
    const existing = await tx.dailyMetric.findUnique({ where: { date: entry.date } })
    if (existing) await recordRevision(tx, 'daily-metric', entry.date, 'update', metricFromRow(existing))
    await insertMetric(tx, entry)
  })
  return entry
}
