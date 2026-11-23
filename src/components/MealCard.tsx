import { mealLabel } from '../constants'
import { formatTime } from '../dates'
import {
  formatCalories,
  formatConsistency,
  formatDuration,
  formatQuantity,
  mealDurationMinutes,
} from '../meals'
import { consumedPercent, consumptionLabel, formatAmount } from '../foods'
import type { FoodEntry, MealEntry, MealItem, Settings } from '../types'
import { MealNutrientsButton } from './MealNutrients'
import { MealPhotoStrip } from './MealPhotos'

function itemLine(item: MealItem) {
  const percent = consumedPercent(item)
  const amount = item.quantityServed != null
    ? item.quantityConsumed != null
      ? `${formatAmount(item.quantityConsumed, item.unit)} of ${formatAmount(item.quantityServed, item.unit)}`
      : `${formatAmount(item.quantityServed, item.unit)} served`
    : ''
  return { percent, amount }
}

export function MealCard({
  entry,
  onSelect,
  nutrients,
}: {
  entry: MealEntry
  onSelect?: () => void
  /** When given, shows a Nutrients button for this meal. */
  nutrients?: { foods: FoodEntry[]; settings: Settings }
}) {
  const duration = mealDurationMinutes(entry)
  const hasItems = entry.items.length > 0
  const chips = [
    entry.quantity != null ? formatQuantity(entry.quantity, entry.quantityUnit) : '',
    formatConsistency(entry.consistency, entry.consistencyPercent),
    entry.source ? entry.source[0].toUpperCase() + entry.source.slice(1) : '',
    entry.calories != null ? formatCalories(entry.calories) : '',
  ].filter(Boolean)

  const body = (
    <>
      <span className="meal-type">{mealLabel(entry.type)}</span>
      {hasItems ? (
        <span className="meal-items">
          {entry.items.map((item) => {
            const { percent, amount } = itemLine(item)
            return (
              <span key={item.id} className={`meal-item ${percent === 0 ? 'refused' : ''}`}>
                <span className="meal-item-name">
                  {item.name}
                  {item.ingredients.length > 0 && (
                    <small> with {item.ingredients.map((child) => child.name).join(', ')}</small>
                  )}
                </span>
                <span className="meal-item-amount">
                  {amount}
                  {amount && percent != null ? ' · ' : ''}
                  {percent != null ? (percent === 0 ? 'Refused' : `${percent}%`) : consumptionLabel(null)}
                </span>
              </span>
            )
          })}
        </span>
      ) : (
        <span className="title">{entry.foods}</span>
      )}
      {chips.length > 0 && (
        <span className="meal-facts">
          {chips.map((chip) => (
            <span className="meal-chip" key={chip}>
              {chip}
            </span>
          ))}
        </span>
      )}
      {entry.notes ? <span className="meal-notes">{entry.notes}</span> : null}
      <span className="meal-when">
        <span>{formatTime(entry.time)}</span>
        {entry.endTime ? (
          <>
            <span className="meal-when-sep" aria-hidden="true">
              →
            </span>
            <span>{formatTime(entry.endTime)}</span>
          </>
        ) : null}
        {duration != null ? <span className="meal-chip">{formatDuration(duration)}</span> : null}
      </span>
    </>
  )

  return (
    <div className="entry meal-card">
      {onSelect ? (
        <button type="button" className="entry-body meal-body" onClick={onSelect}>
          {body}
        </button>
      ) : (
        <div className="entry-body meal-body">{body}</div>
      )}
      {nutrients && entry.items.length > 0 && (
        <div className="meal-card-actions">
          <MealNutrientsButton meal={entry} foods={nutrients.foods} settings={nutrients.settings} />
        </div>
      )}
      <MealPhotoStrip
        mealId={entry.id}
        before={entry.hasBeforePhoto}
        after={entry.hasAfterPhoto}
      />
    </div>
  )
}
