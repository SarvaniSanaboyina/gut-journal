import { useMemo, useState } from 'react'
import { MEAL_CONSISTENCIES, MEAL_TYPES, QUANTITY_UNITS } from '../constants'
import { defaultMealType, nowTime } from '../dates'
import { formatCalories, formatDuration, mealDurationMinutes, totalCalories } from '../meals'
import { compressImage, deletePhoto, putPhoto } from '../photos'
import type { MealConsistency, MealEntry, MealType, QuantityUnit } from '../types'
import { PhotoSlot } from './MealPhotos'

function defaultUnit(consistency: MealConsistency): QuantityUnit {
  return consistency === 'liquid' ? 'cups' : 'spoons'
}

export function MealForm({
  date,
  initial,
  logged = [],
  onSave,
  onDelete,
  onCancel,
}: {
  date: string
  initial?: MealEntry
  logged?: MealEntry[]
  onSave: (entry: MealEntry) => void | Promise<void>
  onDelete?: () => void
  onCancel: () => void
}) {
  const [type, setType] = useState<MealType>(initial?.type ?? defaultMealType())
  const [time, setTime] = useState(initial?.time ?? nowTime())
  const [endTime, setEndTime] = useState(initial?.endTime ?? '')
  const [foods, setFoods] = useState(initial?.foods ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity != null ? String(initial.quantity) : '')
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(initial?.quantityUnit ?? 'spoons')
  const [consistency, setConsistency] = useState<MealConsistency>(initial?.consistency ?? 'solid')
  const [consistencyPercent, setConsistencyPercent] = useState(initial?.consistencyPercent ?? 50)
  const [calories, setCalories] = useState(initial?.calories != null ? String(initial.calories) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [beforePhoto, setBeforePhoto] = useState<File | 'keep' | 'remove'>('keep')
  const [afterPhoto, setAfterPhoto] = useState<File | 'keep' | 'remove'>('keep')
  const [saving, setSaving] = useState(false)

  const duration = useMemo(
    () => mealDurationMinutes({ time, endTime }),
    [time, endTime],
  )
  const parsedCaloriesPreview = calories.trim() === '' ? null : Number(calories)
  const thisCalories = parsedCaloriesPreview != null && Number.isFinite(parsedCaloriesPreview) ? parsedCaloriesPreview : 0
  const alreadyCalories = totalCalories(logged.filter((item) => item.id !== initial?.id && item.date === date))
  const calorieTotal = alreadyCalories + thisCalories

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!foods.trim() || saving) return
        const parsedQuantity = quantity.trim() === '' ? null : Number(quantity)
        const parsedCalories = calories.trim() === '' ? null : Number(calories)
        const id = initial?.id ?? crypto.randomUUID()
        setSaving(true)
        try {
          let hasBeforePhoto = initial?.hasBeforePhoto ?? false
          let hasAfterPhoto = initial?.hasAfterPhoto ?? false
          if (beforePhoto instanceof File) {
            await putPhoto(id, 'before', await compressImage(beforePhoto).catch(() => beforePhoto))
            hasBeforePhoto = true
          } else if (beforePhoto === 'remove') {
            await deletePhoto(id, 'before')
            hasBeforePhoto = false
          }
          if (afterPhoto instanceof File) {
            await putPhoto(id, 'after', await compressImage(afterPhoto).catch(() => afterPhoto))
            hasAfterPhoto = true
          } else if (afterPhoto === 'remove') {
            await deletePhoto(id, 'after')
            hasAfterPhoto = false
          }
          await onSave({
            id,
            date,
            time,
            endTime,
            type,
            foods: foods.trim(),
            quantity: parsedQuantity != null && Number.isFinite(parsedQuantity) ? parsedQuantity : null,
            quantityUnit,
            consistency,
            consistencyPercent: consistency === 'semi-solid' ? consistencyPercent : null,
            calories: parsedCalories != null && Number.isFinite(parsedCalories) ? parsedCalories : null,
            notes: notes.trim(),
            hasBeforePhoto,
            hasAfterPhoto,
          })
        } finally {
          setSaving(false)
        }
      }}
    >
      <div className="choice-grid meals">
        {MEAL_TYPES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`choice ${type === item.id ? 'selected' : ''}`}
            onClick={() => setType(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="time-pair">
        <label className="field">
          <span>Start time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label className="field">
          <span>End time (optional)</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
      </div>
      {duration != null && (
        <div className="duration-chip">He ate for {formatDuration(duration)}</div>
      )}

      <label className="field">
        <span>What did he eat?</span>
        <textarea
          value={foods}
          onChange={(e) => setFoods(e.target.value)}
          placeholder="Dosa, yogurt, banana..."
          required
        />
      </label>

      <div>
        <span className="field-label">How much did he eat?</span>
        <div className="qty-row">
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 4"
          />
          <div className="choice-row units">
            {QUANTITY_UNITS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`choice ${quantityUnit === item.id ? 'selected' : ''}`}
                onClick={() => setQuantityUnit(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="field-label">Consistency</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {MEAL_CONSISTENCIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`choice ${consistency === item.id ? 'selected' : ''}`}
              onClick={() => {
                setConsistency(item.id)
                if (!quantity) setQuantityUnit(defaultUnit(item.id))
              }}
            >
              {item.label}
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
      </div>

      {consistency === 'semi-solid' && (
        <label className="field">
          <span>How thick? {consistencyPercent}% solid</span>
          <input
            type="range"
            min="10"
            max="90"
            step="5"
            value={consistencyPercent}
            onChange={(e) => setConsistencyPercent(Number(e.target.value))}
          />
          <div className="slider-labels">
            <span>More liquid</span>
            <span>More solid</span>
          </div>
        </label>
      )}

      <div>
        <span className="field-label">Photos</span>
        <div className="photo-slots">
          <PhotoSlot
            label="Before"
            slot="before"
            mealId={initial?.id}
            hasExisting={Boolean(initial?.hasBeforePhoto)}
            onChange={setBeforePhoto}
          />
          <PhotoSlot
            label="After"
            slot="after"
            mealId={initial?.id}
            hasExisting={Boolean(initial?.hasAfterPhoto)}
            onChange={setAfterPhoto}
          />
        </div>
      </div>

      <label className="field">
        <span>Calories (optional)</span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="e.g. 180"
        />
      </label>
      {(alreadyCalories > 0 || thisCalories > 0) && (
        <div className="calorie-total">
          <span>Total calorie consumption</span>
          <strong>{formatCalories(calorieTotal)}</strong>
        </div>
      )}

      <label className="field">
        <span>Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="New food, leftovers, needed help..."
        />
      </label>
      <div className="actions">
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save meal'}
        </button>
      </div>
    </form>
  )
}
