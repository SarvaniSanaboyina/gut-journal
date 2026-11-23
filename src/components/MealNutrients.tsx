import { useMemo, useState } from 'react'
import { mealLabel } from '../constants'
import { formatTime } from '../dates'
import { formatNutrient, NUTRIENT_ORDER, NUTRIENTS, referenceValues, summarise } from '../nutrition'
import type { FoodEntry, MealEntry, Settings } from '../types'
import { Modal } from './Modal'

/** Estimated nutrients for one meal: totals, share of the day's reference, and a per-food breakdown. */
export function MealNutrientsDetail({ meal, foods, settings }: { meal: MealEntry; foods: FoodEntry[]; settings: Settings }) {
  const summary = useMemo(() => summarise([meal], foods), [meal, foods])
  const refs = referenceValues(settings, meal.date)
  const missing = summary.items.filter((item) => item.status === 'missing')

  if (meal.items.length === 0) {
    return (
      <p className="muted-note">
        This meal was logged as text only{meal.foods ? ` (“${meal.foods}”)` : ''}, so its nutrients can’t be estimated. Edit it and pick the foods from the list to see nutrients.
      </p>
    )
  }

  return (
    <div className="meal-nutrients">
      <p className="day-detail-date">{mealLabel(meal.type)} · {formatTime(meal.time)}</p>

      <div className="chart-table-wrap">
        <table className="chart-table nutrient-assessment">
          <thead>
            <tr>
              <th scope="col">Nutrient</th>
              <th scope="col">This meal (est.)</th>
              <th scope="col">Of daily reference</th>
            </tr>
          </thead>
          <tbody>
            {NUTRIENT_ORDER.map((key) => {
              const total = summary.totals[key]
              const reference = refs.values[key]
              return (
                <tr key={key}>
                  <th scope="row">{NUTRIENTS[key].label}</th>
                  <td>
                    <span className="amt">{total.unknown ? '≥ ' : ''}{formatNutrient(key, total.value)}</span>
                  </td>
                  <td>
                    {reference ? (
                      <>
                        <span className="amt">{total.unknown ? '≥ ' : ''}{Math.round((total.value / reference) * 100)}%</span>
                        <small>of {formatNutrient(key, reference)}/day</small>
                      </>
                    ) : (
                      <small>no daily reference</small>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="meal-nutrient-foods">
        <strong>By food</strong>
        <ul>
          {summary.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className={item.status}>
              <span className="food-name">{item.name}</span>
              {item.status === 'refused' ? (
                <small>refused — counted as nothing eaten</small>
              ) : item.status === 'missing' ? (
                <small>not estimated: {item.reason.toLowerCase()}</small>
              ) : (
                <small>
                  {item.grams != null ? `${Math.round(item.grams)} g · ` : ''}
                  {item.values.energyKcal != null ? `${Math.round(item.values.energyKcal)} kcal · ` : ''}
                  {item.values.proteinG != null ? `${Math.round(item.values.proteinG * 10) / 10} g protein · ` : ''}
                  {item.reason}
                </small>
              )}
            </li>
          ))}
        </ul>
      </section>

      {missing.length > 0 && (
        <p className="muted-note">
          “≥” means the total leaves out {missing.length === 1 ? 'one food' : `${missing.length} foods`} without an amount or nutrient data, so the real amount is higher.
        </p>
      )}
      <p className="muted-note nutrition-disclaimer">
        Daily references: {refs.note} Estimates from recorded amounts and food composition data (IFCT 2017 where available) — not a medical or
        dietary diagnosis. One meal is only part of the day; see the day’s total in History.
      </p>
    </div>
  )
}

/** A small "Nutrients" button that opens the meal's nutrient breakdown in a sheet. */
export function MealNutrientsButton({ meal, foods, settings, className = 'slot-btn' }: { meal: MealEntry; foods: FoodEntry[]; settings: Settings; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={`Nutrients for ${mealLabel(meal.type).toLowerCase()} at ${formatTime(meal.time)}`}>
        Nutrients
      </button>
      {open && (
        <Modal title="Meal nutrients" onClose={() => setOpen(false)}>
          <MealNutrientsDetail meal={meal} foods={foods} settings={settings} />
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  )
}
