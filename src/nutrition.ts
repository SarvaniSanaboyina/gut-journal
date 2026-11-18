import type { NutrientKey } from './types'

export const NUTRIENTS: Record<NutrientKey, { label: string; unit: string; digits: number }> = {
  energyKcal: { label: 'Energy', unit: 'kcal', digits: 0 },
  proteinG: { label: 'Protein', unit: 'g', digits: 1 },
  carbsG: { label: 'Carbohydrates', unit: 'g', digits: 0 },
  fatG: { label: 'Fat', unit: 'g', digits: 1 },
  fibreG: { label: 'Fibre', unit: 'g', digits: 1 },
  ironMg: { label: 'Iron', unit: 'mg', digits: 1 },
  calciumMg: { label: 'Calcium', unit: 'mg', digits: 0 },
  vitaminDUg: { label: 'Vitamin D', unit: 'µg', digits: 1 },
  zincMg: { label: 'Zinc', unit: 'mg', digits: 1 },
  vitaminCMg: { label: 'Vitamin C', unit: 'mg', digits: 0 },
  omega3G: { label: 'Omega-3', unit: 'g', digits: 2 },
}

export const NUTRIENT_ORDER = Object.keys(NUTRIENTS) as NutrientKey[]
