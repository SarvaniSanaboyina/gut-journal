import { useMemo, useState } from 'react'
import { MEAL_CONSISTENCIES, MEAL_TYPES, mealLabel } from '../constants'
import { defaultMealType, nowTime } from '../dates'
import {
  CONSUMPTION_CHOICES,
  consumedPercent,
  copyItems,
  foodMap,
  FOOD_UNITS,
  formatAmount,
  itemWithDefaultIngredients,
  MEAL_SOURCES,
  newIngredient,
  newItem,
  PREPARATION_METHODS,
  recentFoods,
  recentMealTemplates,
  searchFoods,
} from '../foods'
import { formatDuration, mealDurationMinutes } from '../meals'
import { isSlotType } from '../mealSlots'
import { compressImage, deletePhoto, putPhoto } from '../photos'
import type { FoodEntry, FoodUnit, MealConsistency, MealEntry, MealItem, MealSource, MealType, SlotType } from '../types'
import { CustomFoodForm } from './CustomFoodForm'
import { FoodPicker } from './FoodPicker'
import { PhotoSlot } from './MealPhotos'
import { Modal } from './Modal'

function stepFor(unit: FoodUnit) {
  if (unit === 'g' || unit === 'ml') return 10
  if (unit === 'spoons') return 1
  return 0.5
}

function cleanNumber(value: number) {
  return Math.round(value * 1000) / 1000
}

function ItemEditor({
  item,
  foods,
  onChange,
  onRemove,
  onCreateFood,
}: {
  item: MealItem
  foods: FoodEntry[]
  onChange: (item: MealItem) => void
  onRemove: () => void
  onCreateFood: (name: string, attach: (food: FoodEntry) => void) => void
}) {
  const [open, setOpen] = useState(false)
  const [ingredientQuery, setIngredientQuery] = useState('')
  const percent = consumedPercent(item)
  const step = stepFor(item.unit)
  const served = item.quantityServed
  const ingredientResults = useMemo(() => searchFoods(foods, ingredientQuery, 8), [foods, ingredientQuery])

  const setServed = (value: number | null) => {
    const next = value == null ? null : Math.max(0, cleanNumber(value))
    const pct = item.consumedPercent
    onChange({
      ...item,
      quantityServed: next,
      quantityConsumed: next != null && pct != null ? cleanNumber((next * pct) / 100) : item.quantityConsumed != null && next != null ? Math.min(item.quantityConsumed, next) : null,
    })
  }

  const setPercent = (pct: number) => {
    onChange({
      ...item,
      consumedPercent: pct,
      quantityConsumed: served != null ? cleanNumber((served * pct) / 100) : null,
    })
  }

  const addIngredient = (food: FoodEntry | null, name?: string) => {
    if (food && item.ingredients.some((child) => child.foodId === food.id)) return
    onChange({ ...item, ingredients: [...item.ingredients, newIngredient(food, name)] })
    setIngredientQuery('')
  }

  return (
    <div className="item-card">
      <div className="item-head">
        <strong>{item.name}</strong>
        <button type="button" className="item-remove" aria-label={`Remove ${item.name}`} onClick={onRemove}>×</button>
      </div>

      <div className="item-row">
        <span className="item-label">Served</span>
        <div className="stepper">
          <button type="button" aria-label="Less" onClick={() => setServed((served ?? step) - step)} disabled={!served}>−</button>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            aria-label={`Amount of ${item.name} served`}
            value={served ?? ''}
            placeholder="?"
            onChange={(event) => setServed(event.target.value === '' ? null : Number(event.target.value))}
          />
          <button type="button" aria-label="More" onClick={() => setServed((served ?? 0) + step)}>+</button>
        </div>
        <select
          aria-label="Unit"
          value={item.unit}
          onChange={(event) => onChange({ ...item, unit: event.target.value as FoodUnit })}
        >
          {FOOD_UNITS.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.label}</option>
          ))}
        </select>
      </div>

      <div className="consume-row" role="group" aria-label={`How much ${item.name} was eaten`}>
        {CONSUMPTION_CHOICES.map((choice) => (
          <button
            key={choice.percent}
            type="button"
            title={choice.label}
            aria-pressed={percent === choice.percent}
            className={`consume ${percent === choice.percent ? 'selected' : ''} ${choice.percent === 0 ? 'refused' : ''}`}
            onClick={() => setPercent(choice.percent)}
          >
            {choice.short}
          </button>
        ))}
      </div>
      <div className="item-summary">
        {served != null && item.quantityConsumed != null
          ? `Ate ${formatAmount(item.quantityConsumed, item.unit)} of ${formatAmount(served, item.unit)}`
          : percent != null
            ? `${percent}% eaten · add the amount served for nutrient estimates`
            : 'Amount eaten not recorded'}
        {item.preparation ? ` · ${item.preparation}` : ''}
        {item.ingredients.length > 0 ? ` · with ${item.ingredients.map((child) => child.name).join(', ')}` : ''}
      </div>

      <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide details' : 'Exact amount, preparation, ingredients'}
      </button>

      {open && (
        <div className="item-details">
          <label className="field">
            <span>Exact amount eaten ({FOOD_UNITS.find((unit) => unit.id === item.unit)?.label})</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={item.quantityConsumed ?? ''}
              onChange={(event) => {
                const value = event.target.value === '' ? null : Math.max(0, Number(event.target.value))
                onChange({
                  ...item,
                  quantityConsumed: value,
                  consumedPercent: value != null && served ? Math.min(300, Math.round((value / served) * 100)) : item.consumedPercent,
                })
              }}
            />
          </label>

          <div>
            <span className="field-label">Preparation</span>
            <div className="choice-row" style={{ marginTop: 6 }}>
              {PREPARATION_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  aria-pressed={item.preparation === method}
                  className={`choice small ${item.preparation === method ? 'selected' : ''}`}
                  onClick={() => onChange({ ...item, preparation: item.preparation === method ? '' : method })}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="field-label">Ingredients</span>
            <div className="food-chips" style={{ marginTop: 6 }}>
              {item.ingredients.map((child) => (
                <span key={child.id} className="food-chip selected static">
                  {child.name}
                  <button
                    type="button"
                    aria-label={`Remove ${child.name}`}
                    onClick={() => onChange({ ...item, ingredients: item.ingredients.filter((other) => other.id !== child.id) })}
                  >
                    ×
                  </button>
                </span>
              ))}
              {item.ingredients.length === 0 && <span className="muted-note">For mixed dishes — e.g. dal, spinach, ghee in khichdi.</span>}
            </div>
            <input
              type="search"
              className="food-search small"
              placeholder="Add an ingredient"
              aria-label={`Add an ingredient to ${item.name}`}
              value={ingredientQuery}
              onChange={(event) => setIngredientQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                if (ingredientResults[0]) addIngredient(ingredientResults[0])
                else if (ingredientQuery.trim()) addIngredient(null, ingredientQuery.trim())
              }}
            />
            {ingredientQuery.trim() && (
              <div className="food-chips" style={{ marginTop: 6 }}>
                {ingredientResults.map((food) => (
                  <button key={food.id} type="button" className="food-chip" onClick={() => addIngredient(food)}>
                    {food.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="food-chip add-new"
                  onClick={() => {
                    const name = ingredientQuery.trim()
                    setIngredientQuery('')
                    onCreateFood(name, (food) => addIngredient(food))
                  }}
                >
                  + New food “{ingredientQuery.trim()}”
                </button>
              </div>
            )}
          </div>

          <label className="field">
            <span>Notes for this food</span>
            <input type="text" value={item.notes} onChange={(event) => onChange({ ...item, notes: event.target.value })} placeholder="New food, different brand…" />
          </label>
        </div>
      )}
    </div>
  )
}

export function MealForm({
  date: initialDate,
  initial,
  meals,
  foods,
  onSaveFood,
  onSave,
  onDelete,
  onCancel,
  defaultType,
  onNotEaten,
}: {
  date: string
  initial?: MealEntry
  meals: MealEntry[]
  foods: FoodEntry[]
  onSaveFood: (food: FoodEntry) => Promise<FoodEntry>
  onSave: (entry: MealEntry) => void | Promise<void>
  onDelete?: () => void
  onCancel: () => void
  /** Preselect a meal type (e.g. when logging from a meal schedule slot). */
  defaultType?: MealType
  /** Record the selected scheduled meal as "Not eaten" instead of logging food. */
  onNotEaten?: (date: string, type: SlotType) => Promise<void>
}) {
  const [date, setDate] = useState(initial?.date ?? initialDate)
  const [time, setTime] = useState(initial?.time ?? nowTime())
  const [type, setType] = useState<MealType>(initial?.type ?? defaultType ?? defaultMealType())
  const [endTime, setEndTime] = useState(initial?.endTime ?? '')
  const [items, setItems] = useState<MealItem[]>(initial?.items ?? [])
  const [legacyFoods, setLegacyFoods] = useState(initial && initial.items.length === 0 ? initial.foods : '')
  const [source, setSource] = useState<MealSource>(initial?.source ?? '')
  const [consistency, setConsistency] = useState<MealConsistency>(initial?.consistency ?? 'solid')
  const [consistencyPercent, setConsistencyPercent] = useState(initial?.consistencyPercent ?? 50)
  const [calories, setCalories] = useState(initial?.calories != null ? String(initial.calories) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [beforePhoto, setBeforePhoto] = useState<File | 'keep' | 'remove'>('keep')
  const [afterPhoto, setAfterPhoto] = useState<File | 'keep' | 'remove'>('keep')
  const [more, setMore] = useState(Boolean(initial && (initial.notes || initial.endTime || initial.calories != null || legacyFoods)))
  const [creating, setCreating] = useState<{ name: string; attach: (food: FoodEntry) => void } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => foodMap(foods), [foods])
  const recent = useMemo(() => recentFoods(meals, foods, 12), [meals, foods])
  const templates = useMemo(
    () => (initial ? [] : recentMealTemplates(meals, type, 3)),
    [initial, meals, type],
  )
  const selected = useMemo(() => new Set(items.map((item) => item.foodId).filter((id): id is string => Boolean(id))), [items])
  const duration = useMemo(() => mealDurationMinutes({ time, endTime }), [time, endTime])

  const addFood = (food: FoodEntry) => {
    if (selected.has(food.id)) {
      setItems((prev) => prev.filter((item) => item.foodId !== food.id))
      return
    }
    setItems((prev) => [...prev, itemWithDefaultIngredients(food, byId)])
  }

  const canSave = items.length > 0 || legacyFoods.trim().length > 0

  return (
    <>
      <form
        className="form-grid meal-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!canSave || saving) return
          const parsedCalories = calories.trim() === '' ? null : Number(calories)
          const id = initial?.id ?? crypto.randomUUID()
          setSaving(true)
          setError(null)
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
              foods: items.length ? '' : legacyFoods.trim(),
              quantity: initial?.quantity ?? null,
              quantityUnit: initial?.quantityUnit ?? 'spoons',
              consistency,
              consistencyPercent: consistency === 'semi-solid' ? consistencyPercent : null,
              calories: parsedCalories != null && Number.isFinite(parsedCalories) ? parsedCalories : null,
              notes: notes.trim(),
              hasBeforePhoto,
              hasAfterPhoto,
              source,
              items: items.map((item) => ({ ...item, name: item.name.trim() })),
            })
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Could not save the meal')
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
              aria-pressed={type === item.id}
              onClick={() => setType(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {onNotEaten && isSlotType(type) && (
          <div className="not-eaten-row">
            <span>{initial ? `Was ${mealLabel(type).toLowerCase()} actually skipped?` : `Didn’t eat ${mealLabel(type).toLowerCase()}?`}</span>
            <button
              type="button"
              className="slot-btn"
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                setError(null)
                try {
                  await onNotEaten(date, type)
                } catch (skipError) {
                  setError(skipError instanceof Error ? skipError.message : 'Could not save')
                } finally {
                  setSaving(false)
                }
              }}
            >
              Mark not eaten
            </button>
          </div>
        )}

        <div className="time-pair">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="field">
            <span>Time</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
          </label>
        </div>

        {templates.length > 0 && items.length === 0 && (
          <div>
            <span className="field-label">Repeat a recent meal</span>
            <div className="food-chips" style={{ marginTop: 6 }}>
              {templates.map((meal) => (
                <button
                  key={meal.id}
                  type="button"
                  className="food-chip template"
                  onClick={() => setItems(copyItems(meal.items))}
                >
                  ↺ {meal.items.map((item) => item.name).join(', ')}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="field-label">What was served?</span>
          <FoodPicker
            foods={foods}
            recent={recent}
            selected={selected}
            onPick={addFood}
            onCreate={(name) => setCreating({ name, attach: (food) => setItems((prev) => [...prev, newItem(food)]) })}
          />
        </div>

        {items.length > 0 && (
          <div className="item-list">
            {items.map((item) => (
              <ItemEditor
                key={item.id}
                item={item}
                foods={foods}
                onChange={(next) => setItems((prev) => prev.map((other) => (other.id === next.id ? next : other)))}
                onRemove={() => setItems((prev) => prev.filter((other) => other.id !== item.id))}
                onCreateFood={(name, attach) => setCreating({ name, attach })}
              />
            ))}
          </div>
        )}

        <div>
          <span className="field-label">Texture</span>
          <div className="choice-row" style={{ marginTop: 8 }}>
            {MEAL_CONSISTENCIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`choice ${consistency === item.id ? 'selected' : ''}`}
                onClick={() => setConsistency(item.id)}
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
              onChange={(event) => setConsistencyPercent(Number(event.target.value))}
            />
          </label>
        )}

        <button type="button" className="link-btn" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? 'Fewer details' : 'More details — where from, photos, notes'}
        </button>

        {more && (
          <div className="more-details">
            <div>
              <span className="field-label">Where was it from?</span>
              <div className="choice-row" style={{ marginTop: 8 }}>
                {MEAL_SOURCES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={source === item.id}
                    className={`choice ${source === item.id ? 'selected' : ''}`}
                    onClick={() => setSource(source === item.id ? '' : item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Finished at (optional)</span>
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
            {duration != null && <div className="duration-chip">The meal took {formatDuration(duration)}</div>}

            <div>
              <span className="field-label">Photos</span>
              <div className="photo-slots">
                <PhotoSlot label="Before" slot="before" mealId={initial?.id} hasExisting={Boolean(initial?.hasBeforePhoto)} onChange={setBeforePhoto} />
                <PhotoSlot label="After" slot="after" mealId={initial?.id} hasExisting={Boolean(initial?.hasAfterPhoto)} onChange={setAfterPhoto} />
              </div>
            </div>

            {(legacyFoods || items.length === 0) && (
              <label className="field">
                <span>Description (if you’d rather type it)</span>
                <textarea value={legacyFoods} onChange={(event) => setLegacyFoods(event.target.value)} placeholder="Dosa, yogurt, banana…" />
              </label>
            )}

            <label className="field">
              <span>Calories from a label or dietitian (optional)</span>
              <input type="number" min="0" step="1" inputMode="decimal" value={calories} onChange={(event) => setCalories(event.target.value)} placeholder="Leave empty to use estimates" />
            </label>

            <label className="field">
              <span>Notes</span>
              <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="New food, fed by grandma, needed help…" />
            </label>
          </div>
        )}

        {error && <div className="alert" role="alert">{error}</div>}

        <div className="actions">
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete}>Delete</button>
          )}
          <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary" disabled={saving || !canSave}>
            {saving ? 'Saving…' : items.length > 1 ? `Save ${items.length} foods` : 'Save meal'}
          </button>
        </div>
      </form>

      {creating && (
        <Modal title="Add a new food" onClose={() => setCreating(null)}>
          <CustomFoodForm
            name={creating.name}
            onCancel={() => setCreating(null)}
            onSave={async (food) => {
              const saved = await onSaveFood(food)
              creating.attach(saved)
              setCreating(null)
            }}
          />
        </Modal>
      )}
    </>
  )
}
