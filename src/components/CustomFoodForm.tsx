import { useMemo, useState } from 'react'
import { FOOD_CATEGORIES, FOOD_GROUPS, FOOD_UNITS, foodMap, gramsFor, searchFoods, unitLabel } from '../foods'
import { formatNutrient, NUTRIENTS } from '../nutrition'
import { recipeNutrients } from '../recipes'
import type { FoodCategory, FoodEntry, FoodGroup, FoodUnit, NutrientKey, Nutrients, Recipe } from '../types'

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

const PREVIEW: NutrientKey[] = ['energyKcal', 'proteinG', 'carbsG', 'fatG', 'fibreG', 'ironMg', 'calciumMg']

type Mode = 'recipe' | 'label' | 'none'

type Row = { key: string; food: FoodEntry; quantity: string; unit: FoodUnit }

function emptyNutrients(): Nutrients {
  return Object.fromEntries(LABEL_FIELDS.map((key) => [key, null])) as Nutrients
}

function defaultUnitFor(food: FoodEntry): FoodUnit {
  // Prefer a unit we can convert to grams; reference foods are per gram.
  return gramsFor(food, 1, food.defaultUnit) ? food.defaultUnit : 'g'
}

function rowGrams(row: Row) {
  const quantity = Number(row.quantity)
  if (!row.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) return null
  return gramsFor(row.food, quantity, row.unit)?.grams ?? null
}

/** Ingredient list with amounts, finished weight and pieces, and a live per-100 g preview. */
function RecipeBuilder({
  foods,
  selfId,
  rows,
  setRows,
  cooked,
  setCooked,
  pieces,
  setPieces,
}: {
  foods: FoodEntry[]
  selfId?: string
  rows: Row[]
  setRows: (rows: Row[]) => void
  cooked: string
  setCooked: (value: string) => void
  pieces: string
  setPieces: (value: string) => void
}) {
  const [query, setQuery] = useState('')
  const candidates = useMemo(() => foods.filter((food) => food.id !== selfId), [foods, selfId])
  const results = useMemo(() => searchFoods(candidates, query, 8), [candidates, query])
  const byId = useMemo(() => foodMap(foods), [foods])
  const recipe = toRecipe(rows, cooked, pieces)
  const preview = recipe ? recipeNutrients(recipe, byId) : null
  const rawGrams = rows.reduce((sum, row) => sum + (rowGrams(row) ?? 0), 0)

  return (
    <div className="recipe-builder">
      <p className="muted-note" style={{ margin: 0 }}>
        Add each ingredient and how much you used for the whole batch. Nutrients are calculated from the food list (Indian Food
        Composition Tables 2017 where available) — no need to enter calories.
      </p>

      {rows.length > 0 && (
        <ul className="recipe-rows">
          {rows.map((row, index) => {
            const grams = rowGrams(row)
            const noData = row.food.nutrientSource === 'none'
            return (
              <li key={row.key}>
                <div className="recipe-row-head">
                  <strong>{row.food.name}</strong>
                  <button type="button" className="item-remove" aria-label={`Remove ${row.food.name}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}>×</button>
                </div>
                <div className="recipe-row-amount">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    aria-label={`Amount of ${row.food.name}`}
                    value={row.quantity}
                    onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, quantity: event.target.value } : item)))}
                  />
                  <select
                    aria-label={`Unit for ${row.food.name}`}
                    value={row.unit}
                    onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, unit: event.target.value as FoodUnit } : item)))}
                  >
                    {FOOD_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
                  </select>
                  <small className={grams == null ? 'warn' : ''}>
                    {noData
                      ? 'no nutrient data — pick a similar food'
                      : grams == null
                        ? row.quantity.trim()
                          ? `weight of one ${unitLabel(row.unit, 1)} unknown — use grams`
                          : 'enter an amount'
                        : row.unit === 'g'
                          ? ''
                          : `≈ ${Math.round(grams)} g`}
                  </small>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <label className="field">
        <span>{rows.length ? 'Add another ingredient' : 'Add an ingredient'}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search — cashew, anjir, jaggery, rava…" aria-label="Search ingredients" />
      </label>
      {query.trim() && (
        <div className="food-chips" role="list">
          {results.map((food) => (
            <button
              key={food.id}
              type="button"
              className="food-chip"
              onClick={() => {
                const unit = defaultUnitFor(food)
                setRows([...rows, { key: crypto.randomUUID(), food, quantity: unit === 'g' ? '' : String(food.defaultQty ?? 1), unit }])
                setQuery('')
              }}
            >
              {food.name}
              {food.isReference && <small>IFCT</small>}
              {food.isCustom && <small>mine</small>}
            </button>
          ))}
          {results.length === 0 && <span className="muted-note">No match. Try another name (local names work too, e.g. “kaju”, “gud”).</span>}
        </div>
      )}

      <div className="time-pair">
        <label className="field">
          <span>Finished weight (g, optional)</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={cooked} placeholder={rawGrams ? String(Math.round(rawGrams)) : ''} onChange={(event) => setCooked(event.target.value)} />
        </label>
        <label className="field">
          <span>Makes how many pieces / servings? (optional)</span>
          <input type="number" min="0" step="1" inputMode="numeric" value={pieces} onChange={(event) => setPieces(event.target.value)} />
        </label>
      </div>
      <p className="muted-note" style={{ margin: 0 }}>
        Weigh the dish after cooking if water was added or cooked off; otherwise the ingredients’ total is used.
      </p>

      {preview && (
        <div className="recipe-preview" aria-live="polite">
          <strong>
            Per 100 g{preview.pieceGrams ? ` · per piece (${Math.round(preview.pieceGrams)} g)` : ''}
          </strong>
          <dl>
            {PREVIEW.map((key) => (
              <div key={key}>
                <dt>{NUTRIENTS[key].label}</dt>
                <dd>
                  {preview.per100[key] == null ? 'no data' : formatNutrient(key, preview.per100[key]!)}
                  {preview.pieceGrams && preview.per100[key] != null && <small>{formatNutrient(key, (preview.per100[key]! * preview.pieceGrams) / 100)}</small>}
                </dd>
              </div>
            ))}
          </dl>
          {preview.withoutData.length > 0 && <p className="alert">No nutrient data for: {preview.withoutData.join(', ')}.</p>}
        </div>
      )}
    </div>
  )
}

function toRecipe(rows: Row[], cooked: string, pieces: string): Recipe | null {
  if (rows.length === 0) return null
  const ingredients = []
  for (const row of rows) {
    const grams = rowGrams(row)
    if (grams == null) return null
    ingredients.push({ foodId: row.food.id, name: row.food.name, quantity: Number(row.quantity), unit: row.unit, grams })
  }
  const cookedGrams = Number(cooked)
  const count = Number(pieces)
  return {
    ingredients,
    cookedGrams: cooked.trim() && Number.isFinite(cookedGrams) && cookedGrams > 0 ? cookedGrams : null,
    pieces: pieces.trim() && Number.isFinite(count) && count >= 1 ? Math.round(count) : null,
  }
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
