import { consumedPercent, formatAmount } from '../foods'
import { formatTime } from '../dates'
import { COMPLETION_LABEL, type DaySummary, type SlotState } from '../mealSlots'
import type { MealEntry, SlotType } from '../types'

function SlotFoods({ slot }: { slot: SlotState }) {
  return (
    <ul className="slot-foods">
      {slot.meals.flatMap((meal) =>
        meal.items.length
          ? meal.items.map((item) => {
              const percent = consumedPercent(item)
              const served = item.quantityServed != null ? formatAmount(item.quantityServed, item.unit) : null
              const eaten = item.quantityConsumed != null ? formatAmount(item.quantityConsumed, item.unit) : null
              return (
                <li key={item.id} className={percent === 0 ? 'refused' : ''}>
                  <span>{item.name}</span>
                  <small>
                    {served ? `served ${served}` : 'served —'}
                    {' · '}
                    {eaten ? `ate ${eaten}` : percent != null ? 'ate' : 'eaten —'}
                    {percent != null ? ` (${Math.round(percent)}%)` : ''}
                  </small>
                </li>
              )
            })
          : [
              <li key={meal.id}>
                <span>{meal.foods || 'Food logged'}</span>
                <small>amounts not recorded</small>
              </li>,
            ],
      )}
    </ul>
  )
}

/**
 * The five scheduled meals for a day with their status, plus the day's tracking completion.
 * Completion is about record-keeping only; it says nothing about whether the diet was balanced.
 */
export function MealSchedule({
  summary,
  onLog,
  onEditMeal,
  onSkip,
  onClearSkip,
  title = 'Meal schedule',
  showSummary = true,
}: {
  summary: DaySummary
  onLog: (type: SlotType) => void
  onEditMeal: (meal: MealEntry) => void
  onSkip: (type: SlotType) => void
  onClearSkip: (type: SlotType) => void
  title?: string
  /** Hide the completion badge and counts when the surrounding view already shows them. */
  showSummary?: boolean
}) {
  const { completion, slots } = summary
  return (
    <section className="section meal-schedule">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          <p>3 main meals and 2 snacks</p>
        </div>
        {showSummary && <span className={`completion-badge ${completion.status}`} role="status">
          <span aria-hidden="true">{completion.status === 'complete' ? '✓' : completion.status === 'incomplete' ? '◐' : '○'}</span>
          {COMPLETION_LABEL[completion.status]}
        </span>}
      </div>
      {showSummary && <div className="slot-counts" aria-label="Meal tracking summary">
        <span><strong>{completion.eaten}</strong>/5 eaten</span>
        <span><strong>{completion.skipped}</strong>/5 skipped</span>
        <span><strong>{completion.notLogged}</strong>/5 not logged</span>
      </div>}
      <ol className="slot-list">
        {slots.map((slot) => {
          const firstMeal = slot.meals[0]
          return (
            <li key={slot.slot.id} className={`slot-row ${slot.status}`}>
              <div className="slot-main">
                <div className="slot-title">
                  <strong>{slot.slot.label}</strong>
                  <small>{slot.slot.kind === 'main' ? 'Main meal' : 'Snack'}{firstMeal ? ` · ${formatTime(firstMeal.time)}` : ''}</small>
                </div>
                <span className={`slot-status ${slot.status}`}>
                  {slot.status === 'eaten' ? 'Eaten' : slot.status === 'not-eaten' ? 'Not eaten' : 'Not logged'}
                  {slot.status === 'eaten' && slot.percent != null ? ` · ${Math.round(slot.percent)}%` : ''}
                </span>
              </div>
              {slot.status === 'eaten' && <SlotFoods slot={slot} />}
              {slot.status === 'not-eaten' && slot.note && <p className="slot-note">{slot.note}</p>}
              <div className="slot-actions">
                {slot.status === 'not-logged' && (
                  <>
                    <button type="button" className="slot-btn primary-soft" onClick={() => onLog(slot.slot.id)}>Log food</button>
                    <button type="button" className="slot-btn" onClick={() => onSkip(slot.slot.id)}>Not eaten</button>
                  </>
                )}
                {slot.status === 'eaten' && (
                  <>
                    {slot.meals.map((meal, index) => (
                      <button key={meal.id} type="button" className="slot-btn" onClick={() => onEditMeal(meal)}>
                        Edit{slot.meals.length > 1 ? ` ${index + 1}` : ''}
                      </button>
                    ))}
                    <button type="button" className="slot-btn" onClick={() => onLog(slot.slot.id)}>+ Add</button>
                    <button type="button" className="slot-btn" onClick={() => onSkip(slot.slot.id)}>Not eaten</button>
                  </>
                )}
                {slot.status === 'not-eaten' && (
                  <>
                    <button type="button" className="slot-btn primary-soft" onClick={() => onLog(slot.slot.id)}>Log food instead</button>
                    <button type="button" className="slot-btn" onClick={() => onClearSkip(slot.slot.id)}>Undo</button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="muted-note slot-disclaimer">“Complete” means every meal was recorded — not that the day’s diet was balanced.</p>
    </section>
  )
}
