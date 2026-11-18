import type { GrowthRecord, PrismaClient } from '@prisma/client'
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
  recordRevision,
} from './validate.ts'

const POSITIONS = ['', 'lying', 'standing'] as const

export type GrowthEntry = {
  id: string
  date: string
  weightKg: number | null
  heightCm: number | null
  /** How length/height was measured; WHO standards use lying length under 2 years and standing height after. */
  position: (typeof POSITIONS)[number]
  notes: string
}

export function growthFromRow(row: GrowthRecord): GrowthEntry {
  return {
    id: row.id,
    date: row.date,
    weightKg: row.weightKg,
    heightCm: row.heightCm,
    position: row.position as GrowthEntry['position'],
    notes: row.notes,
  }
}

export function parseGrowth(value: unknown, fromImport = false): GrowthEntry {
  if (!isRecord(value)) return bad('Invalid growth record')
  const weightKg = parseOptionalNumber(value.weightKg, 'weight', 60)
  const heightCm = parseOptionalNumber(value.heightCm, 'height', 150)
  if (weightKg == null && heightCm == null) return bad('Enter a weight or a height')
  if (weightKg != null && weightKg < 1) return bad('Weight looks too low — enter it in kilograms')
  if (heightCm != null && heightCm < 40) return bad('Height looks too low — enter it in centimetres')
  return {
    id: parseId(value.id, fromImport),
    date: parseDate(value.date),
    weightKg: weightKg == null ? null : Math.round(weightKg * 1000) / 1000,
    heightCm: heightCm == null ? null : Math.round(heightCm * 10) / 10,
    position: oneOf(typeof value.position === 'string' ? value.position : '', POSITIONS, 'measurement position'),
    notes: parseText(value.notes, MAX_TEXT),
  }
}

export async function insertGrowth(db: Db, entry: GrowthEntry) {
  const data = {
    date: entry.date,
    weightKg: entry.weightKg,
    heightCm: entry.heightCm,
    position: entry.position,
    notes: entry.notes,
  }
  await db.growthRecord.upsert({ where: { id: entry.id }, create: { id: entry.id, ...data }, update: data })
}

export async function readGrowth(db: Db) {
  const rows = await db.growthRecord.findMany({ orderBy: [{ date: 'asc' }, { id: 'asc' }] })
  return rows.map(growthFromRow)
}

export async function saveGrowth(db: PrismaClient, body: unknown) {
  const entry = parseGrowth(body)
  return db.$transaction(async (tx) => {
    const existing = await tx.growthRecord.findUnique({ where: { id: entry.id } })
    if (existing) await recordRevision(tx, 'growth', entry.id, 'update', growthFromRow(existing))
    await insertGrowth(tx, entry)
    return growthFromRow(await tx.growthRecord.findUniqueOrThrow({ where: { id: entry.id } }))
  })
}

export async function removeGrowth(db: PrismaClient, idValue: string) {
  const id = parseId(idValue)
  await db.$transaction(async (tx) => {
    const existing = await tx.growthRecord.findUnique({ where: { id } })
    if (existing) await recordRevision(tx, 'growth', id, 'delete', growthFromRow(existing))
    await tx.growthRecord.deleteMany({ where: { id } })
  })
}
