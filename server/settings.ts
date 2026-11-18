import type { Prisma, PrismaClient } from '@prisma/client'
import { NUTRIENT_KEYS, type NutrientKey } from './foodCatalog.ts'
import { bad, type Db, isRecord, oneOf, parseDate, parseOptionalNumber, recordRevision } from './validate.ts'

export type ChildProfile = { sex: '' | 'female' | 'male'; birthDate: string }
export type NutrientReferences = { custom: Partial<Record<NutrientKey, number>> }
export type Settings = { childProfile: ChildProfile; nutrientReferences: NutrientReferences }

const KEYS = { 'child-profile': 'childProfile', 'nutrient-references': 'nutrientReferences' } as const

export function defaultSettings(): Settings {
  return { childProfile: { sex: '', birthDate: '' }, nutrientReferences: { custom: {} } }
}

function parseProfile(value: unknown): ChildProfile {
  if (!isRecord(value)) return bad('Invalid child profile')
  const birthDate = value.birthDate == null || value.birthDate === '' ? '' : parseDate(value.birthDate)
  return { sex: oneOf(typeof value.sex === 'string' ? value.sex : '', ['', 'female', 'male'] as const, 'sex'), birthDate }
}

function parseReferences(value: unknown): NutrientReferences {
  if (!isRecord(value)) return bad('Invalid reference values')
  const custom: Partial<Record<NutrientKey, number>> = {}
  if (isRecord(value.custom)) {
    for (const key of NUTRIENT_KEYS) {
      const number = parseOptionalNumber(value.custom[key], 'reference value', 10000)
      if (number != null && number > 0) custom[key] = number
    }
  }
  return { custom }
}

function parse(key: keyof typeof KEYS, value: unknown) {
  return key === 'child-profile' ? parseProfile(value) : parseReferences(value)
}

export async function readSettings(db: Db): Promise<Settings> {
  const rows = await db.setting.findMany()
  const settings = defaultSettings()
  for (const row of rows) {
    try {
      if (row.key === 'child-profile') settings.childProfile = parseProfile(row.value)
      if (row.key === 'nutrient-references') settings.nutrientReferences = parseReferences(row.value)
    } catch {
      // A malformed stored value falls back to the defaults rather than breaking the journal.
    }
  }
  return settings
}

export async function writeSetting(db: Db, keyValue: string, body: unknown) {
  if (!(keyValue in KEYS)) return bad('Unknown setting')
  const key = keyValue as keyof typeof KEYS
  const value = parse(key, body)
  const existing = await db.setting.findUnique({ where: { key } })
  if (existing) await recordRevision(db, 'setting', key, 'update', existing.value)
  const json = value as unknown as Prisma.InputJsonValue
  await db.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } })
  return value
}

export async function saveSetting(db: PrismaClient, key: string, body: unknown) {
  return db.$transaction((tx) => writeSetting(tx, key, body))
}

export async function importSettings(db: Db, value: unknown) {
  if (!isRecord(value)) return
  await db.setting.deleteMany()
  if (value.childProfile) await writeSetting(db, 'child-profile', value.childProfile)
  if (value.nutrientReferences) await writeSetting(db, 'nutrient-references', value.nutrientReferences)
}
