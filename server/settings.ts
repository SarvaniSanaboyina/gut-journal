import type { Prisma, PrismaClient } from '@prisma/client'
import { NUTRIENT_KEYS, type NutrientKey } from './foodCatalog.ts'
import { bad, type Db, isRecord, oneOf, parseDate, parseOptionalNumber, recordRevision } from './validate.ts'

export type ChildProfile = { sex: '' | 'female' | 'male'; birthDate: string }
export type NutrientReferences = { custom: Partial<Record<NutrientKey, number>> }
/** Overrides for the daily nutrition assessment; anything missing uses the app's defaults. */
export type NutritionAssessmentSettings = Partial<{
  lowPercent: number
  energyHighPercent: number
  aboveRecommendedPercent: number
  minCoveragePercent: number
  belowSharePercent: number
  keyNutrients: NutrientKey[]
}>
export type Settings = { childProfile: ChildProfile; nutrientReferences: NutrientReferences; nutritionAssessment: NutritionAssessmentSettings }

const KEYS = { 'child-profile': 'childProfile', 'nutrient-references': 'nutrientReferences', 'nutrition-assessment': 'nutritionAssessment' } as const

export function defaultSettings(): Settings {
  return { childProfile: { sex: '', birthDate: '' }, nutrientReferences: { custom: {} }, nutritionAssessment: {} }
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

const ASSESSMENT_LIMITS = {
  lowPercent: [10, 100],
  energyHighPercent: [100, 300],
  aboveRecommendedPercent: [100, 1000],
  minCoveragePercent: [0, 100],
  belowSharePercent: [1, 100],
} as const

function parseAssessment(value: unknown): NutritionAssessmentSettings {
  if (!isRecord(value)) return bad('Invalid nutrition assessment settings')
  const result: NutritionAssessmentSettings = {}
  for (const [key, [min, max]] of Object.entries(ASSESSMENT_LIMITS) as [keyof typeof ASSESSMENT_LIMITS, readonly [number, number]][]) {
    const number = parseOptionalNumber(value[key], key, max)
    if (number == null) continue
    if (number < min) return bad(`${key} must be at least ${min}`)
    result[key] = number
  }
  if (result.lowPercent != null && result.energyHighPercent != null && result.lowPercent >= result.energyHighPercent) {
    return bad('The low threshold must be below the energy high threshold')
  }
  if (value.keyNutrients != null) {
    if (!Array.isArray(value.keyNutrients)) return bad('Invalid key nutrients')
    const keys = value.keyNutrients.map((item) => oneOf(String(item), NUTRIENT_KEYS, 'nutrient'))
    result.keyNutrients = [...new Set(keys)]
  }
  return result
}

function parse(key: keyof typeof KEYS, value: unknown) {
  if (key === 'child-profile') return parseProfile(value)
  if (key === 'nutrition-assessment') return parseAssessment(value)
  return parseReferences(value)
}

export async function readSettings(db: Db): Promise<Settings> {
  const rows = await db.setting.findMany()
  const settings = defaultSettings()
  for (const row of rows) {
    try {
      if (row.key === 'child-profile') settings.childProfile = parseProfile(row.value)
      if (row.key === 'nutrient-references') settings.nutrientReferences = parseReferences(row.value)
      if (row.key === 'nutrition-assessment') settings.nutritionAssessment = parseAssessment(row.value)
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
  if (value.nutritionAssessment) await writeSetting(db, 'nutrition-assessment', value.nutritionAssessment)
}
