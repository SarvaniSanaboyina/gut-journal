import { useMemo, useState } from 'react'
import { FOOD_CATEGORIES, FOOD_GROUPS, FOOD_UNITS, foodMap } from '../foods'
import { NUTRIENTS } from '../nutrition'
import { recipeNutrients, toRecipe, type Row } from '../recipes'
import { RecipeBuilder } from './RecipeBuilder'
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

type Mode = 'recipe' | 'label' | 'none'

function emptyNutrients(): Nutrients {
  return Object.fromEntries(LABEL_FIELDS.map((key) => [key, null])) as Nutrients
}

/** Add or edit a family food: nutrients come from its ingredients (a recipe), a pack label, or nowhere. */
export function CustomFoodForm({
  initial,
  name: initialName = '',
  foods,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: FoodEntry
  name?: string
  /** The full food list, for picking recipe ingredients. */
  foods: FoodEntry[]
  onSave: (food: FoodEntry) => Promise<void> | void
  onCancel: () => void
  onDelete?: () => void
}) {
  const byId = useMemo(() => foodMap(foods), [foods])
  const [name, setName] = useState(initial?.name ?? initialName)
  const [category, setCategory] = useState<FoodCategory>(initial?.category ?? 'snacks')
  const [groups, setGroups] = useState<FoodGroup[]>(initial?.groups ?? [])
  const [unit, setUnit] = useState<FoodUnit>(initial?.defaultUnit ?? 'pieces')
  const [pieceGrams, setPieceGrams] = useState(initial?.unitGrams.pieces != null ? String(initial.unitGrams.pieces) : '')
  const [mode, setMode] = useState<Mode>(initial ? (initial.recipe ? 'recipe' : initial.nutrientSource === 'label' ? 'label' : 'none') : 'recipe')
  const [nutrients, setNutrients] = useState<Record<NutrientKey, string>>(() => {
    const source = initial?.nutrientSource === 'label' ? initial.nutrients : emptyNutrients()
    return Object.fromEntries(LABEL_FIELDS.map((key) => [key, source[key] == null ? '' : String(source[key])])) as Record<NutrientKey, string>
  })
  const [rows, setRows] = useState<Row[]>(() =>
    (initial?.recipe?.ingredients ?? []).flatMap((item) => {
      const food = byId.get(item.foodId)
      return food ? [{ key: crypto.randomUUID(), food, quantity: String(item.quantity), unit: item.unit }] : []
    }),
  )
  const [cooked, setCooked] = useState(initial?.recipe?.cookedGrams != null ? String(initial.recipe.cookedGrams) : '')
  const [pieces, setPieces] = useState(initial?.recipe?.pieces != null ? String(initial.recipe.pieces) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="form-grid custom-food"
      onSubmit={async (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!name.trim() || saving) return
        let food: FoodEntry
        const base = {
          id: initial?.id ?? `custom-${crypto.randomUUID()}`,
          name: name.trim(),
          aliases: initial?.aliases ?? [],
          category,
          groups,
          defaultQty: initial?.defaultQty ?? 1,
          sourceNote: '',
          isCustom: true,
          isReference: false,
        }
        if (mode === 'recipe') {
          const recipe = toRecipe(rows, cooked, pieces)
          if (!recipe) return setError(rows.length ? 'Enter an amount for every ingredient (use grams if a piece weight is unknown).' : 'Add at least one ingredient.')
          const result = recipeNutrients(recipe, byId)
          if (result.withoutData.length) return setError(`No nutrient data for ${result.withoutData.join(', ')} — remove it or pick a similar food.`)
          food = {
            ...base,
            defaultUnit: recipe.pieces ? 'pieces' : unit,
            unitGrams: recipe.pieces && result.pieceGrams ? { ...initial?.unitGrams, pieces: Math.round(result.pieceGrams * 10) / 10 } : pieceGramsValue(pieceGrams, initial),
            // The server recalculates these from the ingredients on save.
            nutrients: result.per100,
            nutrientSource: 'recipe',
            ingredients: [...new Set(recipe.ingredients.map((item) => item.foodId))],
            recipe,
          }
        } else {
          const parsed = emptyNutrients()
          if (mode === 'label') {
            for (const key of LABEL_FIELDS) {
              const raw = nutrients[key].trim()
              if (!raw) continue
              const value = Number(raw)
              if (!Number.isFinite(value) || value < 0) return setError(`${NUTRIENTS[key].label} must be a number`)
              parsed[key] = value
            }
          }
          food = {
            ...base,
            defaultUnit: unit,
            unitGrams: pieceGramsValue(pieceGrams, initial),
            nutrients: parsed,
            nutrientSource: mode === 'label' && LABEL_FIELDS.some((key) => parsed[key] != null) ? 'label' : 'none',
            ingredients: [],
            recipe: null,
          }
        }
        setSaving(true)
        setError(null)
        try {
          await onSave(food)
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
        <span className="field-label">Nutrition</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {([
            ['recipe', 'Calculate from ingredients'],
            ['label', 'From a pack label'],
            ['none', 'Not known'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={mode === id} className={`choice ${mode === id ? 'selected' : ''}`} onClick={() => setMode(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'recipe' && (
        <RecipeBuilder foods={foods} selfId={initial?.id} rows={rows} setRows={setRows} cooked={cooked} setCooked={setCooked} pieces={pieces} setPieces={setPieces} />
      )}

      {mode === 'label' && (
        <div className="label-grid">
          {LABEL_FIELDS.map((key) => (
            <label key={key} className="field">
              <span>{NUTRIENTS[key].label} ({NUTRIENTS[key].unit} per 100 g)</span>
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
        {!(mode === 'recipe' && pieces.trim()) && (
          <label className="field">
            <span>Weight of one piece (g, optional)</span>
            <input type="number" min="0" step="any" inputMode="decimal" value={pieceGrams} onChange={(event) => setPieceGrams(event.target.value)} />
          </label>
        )}
      </div>

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

function pieceGramsValue(value: string, initial?: FoodEntry) {
  const grams = Number(value)
  return value.trim() && Number.isFinite(grams) && grams > 0 ? { ...initial?.unitGrams, pieces: grams } : {}
}
