import { parseISODate } from './dates'
import type { ChildProfile, GrowthEntry, JournalData } from './types'
import { BMI_FOR_AGE, LENGTH_FOR_AGE, WEIGHT_FOR_AGE, type LmsRow } from './whoTables'

/**
 * WHO Child Growth Standards (0–5 years) z-scores and percentiles, following the method in the
 * WHO `anthro` software: the LMS formula, with the "restricted" adjustment beyond ±3 SD for weight
 * and BMI, and the ±0.7 cm correction when length/height was measured in the other position.
 *
 * These are screening estimates for a conversation with a pediatrician, not an assessment.
 */

export const WHO_MAX_DAYS = 1826
/** Day from which WHO uses standing height instead of lying length. */
const HEIGHT_FROM_DAY = 731

export type Indicator = 'weight' | 'height' | 'bmi'

export const INDICATORS: Record<Indicator, { label: string; unit: string; short: string }> = {
  weight: { label: 'Weight-for-age', unit: 'kg', short: 'Weight' },
  height: { label: 'Length/height-for-age', unit: 'cm', short: 'Height' },
  bmi: { label: 'BMI-for-age', unit: 'kg/m²', short: 'BMI' },
}

export function ageInDays(birthDate: string, onISO: string): number {
  const ms = parseISODate(onISO).getTime() - parseISODate(birthDate).getTime()
  return Math.round(ms / 86_400_000)
}

function lmsAt(rows: readonly LmsRow[], days: number, indicator: Indicator): [number, number, number] {
  // Length (lying) and height (standing) curves are separate either side of day 730/731.
  const usable =
    indicator === 'height'
      ? rows.filter((row) => (days < HEIGHT_FROM_DAY ? row[0] < HEIGHT_FROM_DAY : row[0] >= HEIGHT_FROM_DAY))
      : rows
  let lower = usable[0]
  let upper = usable[usable.length - 1]
  for (const row of usable) {
    if (row[0] <= days) lower = row
    if (row[0] >= days) {
      upper = row
      break
    }
  }
  if (upper[0] === lower[0]) return [lower[1], lower[2], lower[3]]
  const t = (days - lower[0]) / (upper[0] - lower[0])
  return [
    lower[1] + (upper[1] - lower[1]) * t,
    lower[2] + (upper[2] - lower[2]) * t,
    lower[3] + (upper[3] - lower[3]) * t,
  ]
}

function rawZ(value: number, [l, m, s]: [number, number, number]) {
  return Math.abs(l) < 1e-9 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s)
}

function valueAtZ(z: number, [l, m, s]: [number, number, number]) {
  return Math.abs(l) < 1e-9 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l)
}

/** z-score per WHO: plain LMS within ±3 SD; beyond that, distance measured in units of the 2–3 SD gap. */
export function zScore(value: number, lms: [number, number, number], restricted: boolean) {
  const z = rawZ(value, lms)
  if (!restricted || Math.abs(z) <= 3) return z
  if (z > 3) {
    const sd3 = valueAtZ(3, lms)
    return 3 + (value - sd3) / (sd3 - valueAtZ(2, lms))
  }
  const sd3 = valueAtZ(-3, lms)
  return -3 + (value - sd3) / (valueAtZ(-2, lms) - sd3)
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 erf approximation, error < 1.5e-7). */
export function normalCdf(z: number) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

export function formatPercentile(z: number) {
  const p = normalCdf(z) * 100
  if (p < 0.1) return 'below 0.1st'
  if (p > 99.9) return 'above 99.9th'
  if (p < 1) return `${p.toFixed(1)}th`
  if (p > 99) return `${p.toFixed(1)}th`
  const n = Math.round(p)
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

export type GrowthScore = { value: number; z: number; percentile: string; median: number }

export type GrowthAssessment = {
  entry: GrowthEntry
  ageDays: number
  /** Why no percentile could be calculated (missing profile, age outside 0–5 years). */
  unavailable: string | null
  /** Height as compared with the WHO curve, after any lying/standing correction. */
  adjustedHeight: number | null
  heightNote: string | null
  weight: GrowthScore | null
  height: GrowthScore | null
  bmi: GrowthScore | null
}

function score(indicator: Indicator, value: number, sex: 'male' | 'female', days: number): GrowthScore {
  const table = indicator === 'weight' ? WEIGHT_FOR_AGE : indicator === 'height' ? LENGTH_FOR_AGE : BMI_FOR_AGE
  const lms = lmsAt(table[sex], days, indicator)
  const z = zScore(value, lms, indicator !== 'height')
  return { value, z, percentile: formatPercentile(z), median: lms[1] }
}

export function assessGrowth(entry: GrowthEntry, profile: ChildProfile): GrowthAssessment {
  const base: GrowthAssessment = {
    entry,
    ageDays: profile.birthDate ? ageInDays(profile.birthDate, entry.date) : -1,
    unavailable: null,
    adjustedHeight: entry.heightCm,
    heightNote: null,
    weight: null,
    height: null,
    bmi: null,
  }
  if (!profile.birthDate) return { ...base, unavailable: 'Add the date of birth in the child profile to see percentiles.' }
  if (!profile.sex) return { ...base, unavailable: 'Add the child’s sex in the child profile — WHO curves differ for girls and boys.' }
  if (base.ageDays < 0) return { ...base, unavailable: 'This measurement is dated before the date of birth.' }
  if (base.ageDays > WHO_MAX_DAYS) return { ...base, unavailable: 'WHO 0–5 year standards end at the 5th birthday.' }
  const days = base.ageDays
  let height = entry.heightCm
  if (height != null) {
    if (days < HEIGHT_FROM_DAY && entry.position === 'standing') {
      height += 0.7
      base.heightNote = 'Standing height under 2 years: 0.7 cm added to compare with the lying-length curve.'
    } else if (days >= HEIGHT_FROM_DAY && entry.position === 'lying') {
      height -= 0.7
      base.heightNote = 'Lying length from 2 years: 0.7 cm subtracted to compare with the standing-height curve.'
    }
  }
  const sex = profile.sex
  const bmiValue = entry.weightKg != null && height != null ? entry.weightKg / (height / 100) ** 2 : null
  return {
    ...base,
    adjustedHeight: height,
    weight: entry.weightKg != null ? score('weight', entry.weightKg, sex, days) : null,
    height: height != null ? score('height', height, sex, days) : null,
    bmi: bmiValue != null ? score('bmi', bmiValue, sex, days) : null,
  }
}

/**
 * Plain-language pointers for a pediatrician conversation. They describe where a measurement sits
 * on the WHO curves; they never label the child.
 */
export function growthNotes(assessments: GrowthAssessment[]): string[] {
  const notes: string[] = []
  const usable = assessments.filter((item) => !item.unavailable).sort((a, b) => a.entry.date.localeCompare(b.entry.date))
  const latest = usable[usable.length - 1]
  if (!latest) return notes
  for (const key of ['weight', 'height', 'bmi'] as const) {
    const value = latest[key]
    if (!value) continue
    if (value.z < -2) notes.push(`${INDICATORS[key].label} is below the 2nd–3rd percentile line (z ${value.z.toFixed(1)}). Worth discussing with your pediatrician.`)
    if (value.z > 2) notes.push(`${INDICATORS[key].label} is above the 97th–98th percentile line (z +${value.z.toFixed(1)}). Worth discussing with your pediatrician.`)
  }
  // A drop of more than 1 z-score in weight between measurements is a common reason clinicians look closer.
  const weights = usable.filter((item) => item.weight)
  if (weights.length >= 2) {
    const first = weights[0]
    const last = weights[weights.length - 1]
    const drop = first.weight!.z - last.weight!.z
    if (drop >= 1) notes.push('Weight has moved down by more than one percentile band since the first record. Share these measurements with your pediatrician.')
    if (last.entry.weightKg! < first.entry.weightKg!) notes.push('The latest weight is lower than an earlier one. Re-check the scale and mention it to your pediatrician if it persists.')
  }
  return notes
}

export const PERCENTILE_LINES: { z: number; label: string }[] = [
  { z: -1.881, label: '3rd' },
  { z: -1.036, label: '15th' },
  { z: 0, label: '50th' },
  { z: 1.036, label: '85th' },
  { z: 1.881, label: '97th' },
]

/** Value of the WHO curve at a given z-score, for drawing percentile lines. */
export function curveValue(indicator: Indicator, sex: 'male' | 'female', days: number, z: number) {
  const table = indicator === 'weight' ? WEIGHT_FOR_AGE : indicator === 'height' ? LENGTH_FOR_AGE : BMI_FOR_AGE
  return valueAtZ(z, lmsAt(table[sex], Math.max(0, Math.min(WHO_MAX_DAYS, days)), indicator))
}

export function formatZ(z: number) {
  return `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(1)}`
}

export function growthAssessments(data: JournalData) {
  return [...data.growth]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => assessGrowth(entry, data.settings.childProfile))
}
