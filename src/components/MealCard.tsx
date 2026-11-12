import { mealLabel } from '../constants'
import { formatTime } from '../dates'
import {
  formatCalories,
  formatConsistency,
  formatDuration,
  formatQuantity,
  mealDurationMinutes,
} from '../meals'
import type { MealEntry } from '../types'
import { MealPhotoStrip } from './MealPhotos'

export function MealCard({
  entry,
  onSelect,
}: {
  entry: MealEntry
  onSelect?: () => void
}) {
  const duration = mealDurationMinutes(entry)
  const chips = [
    entry.quantity != null ? formatQuantity(entry.quantity, entry.quantityUnit) : '',
    formatConsistency(entry.consistency, entry.consistencyPercent),
    entry.calories != null ? formatCalories(entry.calories) : '',
  ].filter(Boolean)

  const body = (
    <>
      <span className="meal-type">{mealLabel(entry.type)}</span>
      <span className="title">{entry.foods}</span>
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
      <MealPhotoStrip
        mealId={entry.id}
        before={entry.hasBeforePhoto}
        after={entry.hasAfterPhoto}
      />
    </div>
  )
}
