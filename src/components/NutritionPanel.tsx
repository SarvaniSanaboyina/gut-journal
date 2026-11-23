import { NUTRIENTS } from '../nutrition'
import { CALENDAR_META, NUTRIENT_STATUS_META, type CalendarState, type DayNutrition, type NutrientAssessment } from '../nutritionAssessment'
import type { NutrientKey } from '../types'

function amount(key: NutrientKey, value: number) {
  const meta = NUTRIENTS[key]
  const factor = 10 ** meta.digits
  return `${Math.round(value * factor) / factor} ${meta.unit}`
}

function ReferenceCell({ item }: { item: NutrientAssessment }) {
  const parts: string[] = []
  if (item.amdr && (item.key === 'carbsG' || item.key === 'fatG')) {
    parts.push(`${item.amdr[0]}–${item.amdr[1]}% of energy`)
    if (item.reference) parts.push(`(≥ ${amount(item.key, item.reference)})`)
  } else if (item.reference) {
    parts.push(amount(item.key, item.reference))
  } else {
    parts.push('—')
  }
  return (
    <>
      {parts.join(' ')}
      {item.upperLimit != null && <small>upper limit {amount(item.key, item.upperLimit)}</small>}
      {item.key === 'proteinG' && item.amdr && <small>up to {item.amdr[1]}% of energy</small>}
    </>
  )
}

/**
 * The day's estimated intake compared with age-specific references: actual amounts and reference
 * amounts, per-nutrient status, missing data, and the overall assessment.
 */
export function NutritionPanel({
  state,
  nutrition,
  completeNote,
}: {
  state: CalendarState
  nutrition: DayNutrition | null
  /** Shown when the day is not yet fully recorded. */
  completeNote?: string
}) {
  const meta = CALENDAR_META[state]
  return (
    <section className="section nutrition-panel">
      <div className="section-head">
        <div>
          <h3>Nutrition estimate</h3>
          <p>{nutrition ? `Compared with ICMR-NIN 2020 references, ages ${nutrition.band} years` : 'Daily intake vs age-specific references'}</p>
        </div>
        <span className={`nutrition-status ${state}`} style={{ background: meta.color }}>{meta.label}</span>
      </div>

      {state === 'not-logged' && <p className="muted-note">{completeNote ?? 'The nutrition assessment runs once all five meals are recorded as eaten or not eaten — missing meals are not counted as zero.'}</p>}
      {nutrition && nutrition.reasons.length > 0 && (
        <ul className="nutrition-reasons">{nutrition.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      )}

      {nutrition && (
        <div className="chart-table-wrap">
          <table className="chart-table nutrient-assessment">
            <thead>
              <tr>
                <th scope="col">Nutrient</th>
                <th scope="col">Eaten (est.)</th>
                <th scope="col">Reference</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {nutrition.nutrients.map((item) => (
                <tr key={item.key} className={item.status}>
                  <th scope="row">{NUTRIENTS[item.key].label}</th>
                  <td>
                    <span className="amt">
                      {item.partial && item.status !== 'insufficient' ? '≥ ' : ''}
                      {amount(item.key, item.amount)}
                    </span>
                    {item.energyShare != null && <small>{Math.round(item.energyShare)}% of energy</small>}
                    {item.partial && <small>{item.covered}/{item.eaten} foods with data</small>}
                  </td>
                  <td><ReferenceCell item={item} /></td>
                  <td>
                    <span className={`status-chip ${item.status}`} title={item.note}>
                      {item.status === 'over-ul' && <span aria-hidden="true">⚠ </span>}
                      {NUTRIENT_STATUS_META[item.status].short}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nutrition && nutrition.overUpperLimit.length > 0 && (
        <div className="care-notice discuss" role="note">
          <strong>Above an upper limit</strong>
          <p>
            Estimated {nutrition.overUpperLimit.map((key) => NUTRIENTS[key].label.toLowerCase()).join(' and ')} intake is above the tolerable upper
            intake level for this age. More is not better here — check portion sizes, fortified foods and any supplements with your pediatrician.
          </p>
        </div>
      )}

      {nutrition && nutrition.missing.length > 0 && (
        <div className="missing-data">
          <strong>Missing nutritional data</strong>
          <ul>{nutrition.missing.map((item, index) => <li key={`${item.name}-${index}`}>{item.name}: {item.reason.toLowerCase()}</li>)}</ul>
        </div>
      )}

      <p className="muted-note nutrition-disclaimer">
        {nutrition?.referenceNote ? `${nutrition.referenceNote} ` : ''}
        Upper limits: US National Academies (IOM). Food values: Indian Food Composition Tables 2017 where available, otherwise
        approximate. These are estimates from what was recorded — not a medical or dietary diagnosis. One day’s intake varies a lot;
        patterns over weeks matter more. Discuss concerns with your pediatrician.
      </p>
    </section>
  )
}
