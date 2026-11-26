import { useMemo, useState } from 'react'
import { FOOD_UNITS, foodMap, searchFoods, unitLabel } from '../foods'
import { formatNutrient, NUTRIENTS } from '../nutrition'
import { defaultUnitFor, recipeNutrients, rowGrams, toRecipe, type Row } from '../recipes'
import type { FoodEntry, FoodUnit, NutrientKey } from '../types'

const PREVIEW: NutrientKey[] = ['energyKcal', 'proteinG', 'carbsG', 'fatG', 'fibreG', 'ironMg', 'calciumMg']

/** Ingredient list with amounts, finished weight and pieces, and a live per-100 g preview. */
export function RecipeBuilder({
  foods,
  selfId,
  rows,
  setRows,
  cooked,
  setCooked,
  pieces,
  setPieces,
  showPreview = true,
}: {
  foods: FoodEntry[]
  selfId?: string
  rows: Row[]
  setRows: (rows: Row[]) => void
  cooked: string
  setCooked: (value: string) => void
  pieces: string
  setPieces: (value: string) => void
  /** The calorie calculator shows its own, fuller results instead of this preview. */
  showPreview?: boolean
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

      {showPreview && preview && (
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
