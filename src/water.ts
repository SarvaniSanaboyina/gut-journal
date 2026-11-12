import type { JournalData, WaterEntry, WaterUnit } from './types'

export const WATER_UNITS: { id: WaterUnit; label: string }[] = [
  { id: 'ml', label: 'ml' },
  { id: 'sips', label: 'Sips' },
  { id: 'cups', label: 'Cups' },
]

export const WATER_PRESETS_ML = [50, 100, 150, 200, 250]

const ML_PER_UNIT: Record<WaterUnit, number> = {
  ml: 1,
  sips: 15,
  cups: 240,
}

export function waterMl(entry: Pick<WaterEntry, 'amount' | 'unit'>): number {
  return entry.amount * (ML_PER_UNIT[entry.unit] ?? 1)
}

export function formatWater(amount: number, unit: WaterUnit): string {
  const rounded = Number.isInteger(amount) ? String(amount) : String(Math.round(amount * 10) / 10)
  if (unit === 'ml') return `${rounded} ml`
  if (unit === 'sips') return `${rounded} sip${amount === 1 ? '' : 's'}`
  return `${rounded} cup${amount === 1 ? '' : 's'}`
}

export function formatTotalMl(ml: number): string {
  const rounded = Math.round(ml)
  if (rounded >= 1000) {
    const liters = rounded / 1000
    const text = Number.isInteger(liters) ? String(liters) : liters.toFixed(1)
    return `${text} L`
  }
  return `${rounded} ml`
}

export function totalWaterMl(entries: WaterEntry[]): number {
  return entries.reduce((sum, item) => sum + waterMl(item), 0)
}

export function weekWater(data: JournalData, days: string[]) {
  const waters = (data.waters ?? []).filter((item) => days.includes(item.date))
  return {
    waters,
    count: waters.length,
    totalMl: totalWaterMl(waters),
    daysWithWater: new Set(waters.map((item) => item.date)).size,
  }
}
