import { useState } from 'react'
import { FOOD_CATEGORIES, FOOD_GROUPS, FOOD_UNITS } from '../foods'
import { NUTRIENTS } from '../nutrition'
import type { FoodCategory, FoodEntry, FoodGroup, FoodUnit, NutrientKey, Nutrients } from '../types'

const LABEL_FIELDS: NutrientKey[] = [
  'energyKcal',
  'proteinG',
  'carbsG',
  'fatG',
  'fibreG',
  'ironMg',
  'calciumMg',
  'vitaminDUg',
  'zincMg',
  'vitaminCMg',
  'omega3G',
]

function emptyNutrients(): Nutrients {
  return Object.fromEntries(LABEL_FIELDS.map((key) => [key, null])) as Nutrients
}

/** Add or edit a family food. Nutrients are optional and only ever come from a pack label. */
export function CustomFoodForm({
  initial,
  name: initialName = '',
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: FoodEntry
  name?: string
  onSave: (food: FoodEntry) => Promise<void> | void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? initialName)
  const [category, setCategory] = useState<FoodCategory>(initial?.category ?? 'snacks')
  const [groups, setGroups] = useState<FoodGroup[]>(initial?.groups ?? [])
  const [unit, setUnit] = useState<FoodUnit>(initial?.defaultUnit ?? 'pieces')
  const [pieceGrams, setPieceGrams] = useState(initial?.unitGrams.pieces != null ? String(initial.unitGrams.pieces) : '')
  const [showLabel, setShowLabel] = useState(Boolean(initial && initial.nutrientSource === 'label'))
  const [nutrients, setNutrients] = useState<Record<NutrientKey, string>>(() => {
    const source = initial?.nutrients ?? emptyNutrients()
    return Object.fromEntries(LABEL_FIELDS.map((key) => [key, source[key] == null ? '' : String(source[key])])) as Record<NutrientKey, string>
  })
  const [ingredients, setIngredients] = useState(initial?.ingredients.join(', ') ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="form-grid custom-food"
      onSubmit={async (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!name.trim() || saving) return
        const parsed = emptyNutrients()
        for (const key of LABEL_FIELDS) {
          const raw = nutrients[key].trim()
          if (!raw) continue
          const value = Number(raw)
          if (!Number.isFinite(value) || value < 0) {
            setError(`${NUTRIENTS[key].label} must be a number`)
            return
          }
          parsed[key] = value
        }
        const grams = Number(pieceGrams)
        setSaving(true)
        setError(null)
        try {
          await onSave({
            id: initial?.id ?? `custom-${crypto.randomUUID()}`,
            name: name.trim(),
            aliases: initial?.aliases ?? [],
            category,
            groups,
            defaultUnit: unit,
            defaultQty: initial?.defaultQty ?? 1,
            unitGrams: pieceGrams.trim() && Number.isFinite(grams) && grams > 0 ? { ...initial?.unitGrams, pieces: grams } : {},
            nutrients: showLabel ? parsed : emptyNutrients(),
            nutrientSource: showLabel && LABEL_FIELDS.some((key) => parsed[key] != null) ? 'label' : 'none',
            sourceNote: '',
            ingredients: ingredients.split(',').map((item) => item.trim()).filter(Boolean),
            isCustom: true,
          })
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Could not save the food')
        } finally {
          setSaving(false)
        }
      }}
    >
      <label className="field">
        <span>Food name</span>
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
      </label>

      <div>
        <span className="field-label">Category</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {FOOD_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`choice ${category === item.id ? 'selected' : ''}`}
              onClick={() => {
                setCategory(item.id)
                if (!initial) setGroups(item.groups)
              }}
            >
              <span aria-hidden="true">{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="field-label">Counts towards (food groups)</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {FOOD_GROUPS.map((item) => {
            const on = groups.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                className={`choice ${on ? 'selected' : ''}`}
                onClick={() => setGroups(on ? groups.filter((group) => group !== item.id) : [...groups, item.id])}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="time-pair">
        <label className="field">
          <span>Usual unit</span>
          <select value={unit} onChange={(event) => setUnit(event.target.value as FoodUnit)}>
            {FOOD_UNITS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Weight of one piece (g, optional)</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={pieceGrams} onChange={(event) => setPieceGrams(event.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Ingredients (optional, comma separated)</span>
        <input type="text" value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="ragi, jaggery, ghee" />
      </label>

      <label className="check-line">
        <input type="checkbox" checked={showLabel} onChange={(event) => setShowLabel(event.target.checked)} />
        Add nutrition from the pack label (per 100 g)
      </label>
      {showLabel && (
        <div className="label-grid">
          {LABEL_FIELDS.map((key) => (
            <label key={key} className="field">
              <span>{NUTRIENTS[key].label} ({NUTRIENTS[key].unit})</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={nutrients[key]}
                onChange={(event) => setNutrients({ ...nutrients, [key]: event.target.value })}
              />
            </label>
          ))}
          <p className="muted-note">Leave a box empty if the label does not list it — it will show as “no data”, not zero.</p>
        </div>
      )}

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="actions inline-actions">
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>Delete</button>
        )}
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save food'}</button>
      </div>
    </form>
  )
}
