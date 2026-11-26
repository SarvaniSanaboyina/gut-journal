import { useMemo, useState } from 'react'
import { todayISO } from '../dates'
import { FOOD_UNITS, foodMap, gramsFor, searchFoods, unitLabel } from '../foods'
import { formatNutrient, NUTRIENT_ORDER, NUTRIENTS, referenceValues } from '../nutrition'
import { defaultUnitFor, recipeNutrients, toRecipe, type Row } from '../recipes'
import type { FoodEntry, FoodGroup, FoodUnit, NutrientKey, Nutrients, Settings } from '../types'
import { RecipeBuilder } from './RecipeBuilder'

type Mode = 'food' | 'recipe'

function sourceLabel(food: FoodEntry) {
  if (food.nutrientSource === 'ifct') return 'Indian Food Composition Tables 2017'
  if (food.nutrientSource === 'recipe') return food.isCustom ? 'your recipe' : 'a standard recipe from IFCT 2017 ingredients'
  if (food.nutrientSource === 'label') return 'the pack label you entered'
  if (food.nutrientSource === 'catalogue') return 'an approximate value (not in IFCT 2017)'
  return 'no data'
}

function scale(per100: Nutrients, grams: number): Nutrients {
  return Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, per100[key] == null ? null : (per100[key]! * grams) / 100])) as Nutrients
}

function value(key: NutrientKey, amount: number | null) {
  return amount == null ? 'no data' : formatNutrient(key, amount)
}

function Headline({ kcal, label }: { kcal: number | null; label: string }) {
  return (
    <div className="calc-headline">
      <span>{label}</span>
      <strong>{kcal == null ? '—' : `${Math.round(kcal)} kcal`}</strong>
    </div>
  )
}

/** Calories and nutrients for an amount of one food. */
function FoodCalculator({ foods, settings }: { foods: FoodEntry[]; settings: Settings }) {
  const [query, setQuery] = useState('')
  const [food, setFood] = useState<FoodEntry | null>(null)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<FoodUnit>('g')
  const results = useMemo(() => searchFoods(foods, query, 10), [foods, query])
  const [today] = useState(todayISO)
  const refs = referenceValues(settings, today)
  const amount = Number(quantity)
  const converted = food && quantity.trim() && Number.isFinite(amount) && amount > 0 ? gramsFor(food, amount, unit) : null
  const nutrients = food && converted && food.nutrientSource !== 'none' ? scale(food.nutrients, converted.grams) : null

  return (
    <div className="form-grid">
      <label className="field">
        <span>Food</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search — idli, anjir, paneer, rice…" aria-label="Search for a food" />
      </label>
      {query.trim() && (
        <div className="food-chips" role="list">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`food-chip ${food?.id === item.id ? 'selected' : ''}`}
              onClick={() => {
                const next = defaultUnitFor(item)
                setFood(item)
                setUnit(next)
                setQuantity(next === 'g' ? '100' : String(item.defaultQty ?? 1))
                setQuery('')
              }}
            >
              {item.name}
              {item.isReference && <small>IFCT</small>}
              {item.isCustom && <small>mine</small>}
            </button>
          ))}
          {results.length === 0 && <span className="muted-note">No match. Local names work too, e.g. “kaju”, “gud”.</span>}
        </div>
      )}

      {food && (
        <>
          <div className="calc-food">
            <strong>{food.name}</strong>
            <div className="recipe-row-amount">
              <input type="number" min="0" step="any" inputMode="decimal" aria-label="Amount" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <select aria-label="Unit" value={unit} onChange={(event) => setUnit(event.target.value as FoodUnit)}>
                {FOOD_UNITS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <small className={quantity.trim() && !converted ? 'warn' : ''}>
                {quantity.trim() && !converted
                  ? `weight of one ${unitLabel(unit, 1)} unknown — use grams`
                  : converted && unit !== 'g'
                    ? `≈ ${Math.round(converted.grams)} g${converted.generic ? ' (standard measure)' : ''}`
                    : ''}
              </small>
            </div>
          </div>

          {food.nutrientSource === 'none' ? (
            <p className="alert">{food.name} has no nutrient data. Try a similar, more specific food.</p>
          ) : (
            <>
              <Headline kcal={nutrients?.energyKcal ?? null} label={converted ? `${Math.round(converted.grams)} g of ${food.name.toLowerCase()}` : 'Enter an amount'} />
              <div className="chart-table-wrap">
                <table className="chart-table nutrient-assessment">
                  <thead>
                    <tr>
                      <th scope="col">Nutrient</th>
                      <th scope="col">This amount</th>
                      <th scope="col">Per 100 g</th>
                      <th scope="col">Of daily reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NUTRIENT_ORDER.map((key) => {
                      const amountValue = nutrients?.[key] ?? null
                      const reference = refs.values[key]
                      return (
                        <tr key={key}>
                          <th scope="row">{NUTRIENTS[key].label}</th>
                          <td><span className="amt">{nutrients ? value(key, amountValue) : '—'}</span></td>
                          <td><span className="amt">{value(key, food.nutrients[key])}</span></td>
                          <td>{amountValue != null && reference ? <span className="amt">{Math.round((amountValue / reference) * 100)}%</span> : <small>—</small>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="muted-note">Values from {sourceLabel(food)}. Daily reference: {refs.note}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

/** Calories and nutrients for a recipe: the whole batch, per 100 g, per piece and per portion. */
function RecipeCalculator({ foods, onSaveFood }: { foods: FoodEntry[]; onSaveFood: (food: FoodEntry) => Promise<unknown> }) {
  const byId = useMemo(() => foodMap(foods), [foods])
  const [rows, setRows] = useState<Row[]>([])
  const [cooked, setCooked] = useState('')
  const [pieces, setPieces] = useState('')
  const [portion, setPortion] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const recipe = toRecipe(rows, cooked, pieces)
  const result = recipe ? recipeNutrients(recipe, byId) : null
  const portionGrams = Number(portion)
  const portionNutrients = result && portion.trim() && Number.isFinite(portionGrams) && portionGrams > 0 ? scale(result.per100, portionGrams) : null

  return (
    <div className="form-grid">
      <RecipeBuilder foods={foods} rows={rows} setRows={setRows} cooked={cooked} setCooked={setCooked} pieces={pieces} setPieces={setPieces} showPreview={false} />

      {rows.length > 0 && !result && <p className="muted-note">Enter an amount for every ingredient to see the calories (use grams if a piece weight is unknown).</p>}

      {result && (
        <>
          {result.withoutData.length > 0 && <p className="alert">No nutrient data for {result.withoutData.join(', ')} — remove it or pick a similar food.</p>}
          <div className="calc-headlines">
            <Headline kcal={result.totals.energyKcal} label={`Whole recipe (${Math.round(result.cookedGrams)} g)`} />
            <Headline kcal={result.per100.energyKcal} label="Per 100 g" />
            {result.pieceGrams && <Headline kcal={result.per100.energyKcal == null ? null : (result.per100.energyKcal * result.pieceGrams) / 100} label={`Per piece (${Math.round(result.pieceGrams)} g)`} />}
            {portionNutrients && <Headline kcal={portionNutrients.energyKcal} label={`Your portion (${Math.round(portionGrams)} g)`} />}
          </div>

          <label className="field">
            <span>Check a portion (g, optional)</span>
            <input type="number" min="0" step="any" inputMode="decimal" value={portion} onChange={(event) => setPortion(event.target.value)} placeholder="e.g. 80" />
          </label>

          <div className="chart-table-wrap">
            <table className="chart-table nutrient-assessment">
              <thead>
                <tr>
                  <th scope="col">Nutrient</th>
                  <th scope="col">Whole recipe</th>
                  <th scope="col">Per 100 g</th>
                  {result.pieceGrams && <th scope="col">Per piece</th>}
                  {portionNutrients && <th scope="col">Portion</th>}
                </tr>
              </thead>
              <tbody>
                {NUTRIENT_ORDER.map((key) => (
                  <tr key={key}>
                    <th scope="row">{NUTRIENTS[key].label}</th>
                    <td><span className="amt">{value(key, result.totals[key])}</span></td>
                    <td><span className="amt">{value(key, result.per100[key])}</span></td>
                    {result.pieceGrams && <td><span className="amt">{value(key, result.per100[key] == null ? null : (result.per100[key]! * result.pieceGrams) / 100)}</span></td>}
                    {portionNutrients && <td><span className="amt">{value(key, portionNutrients[key])}</span></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted-note">
            Calculated from each ingredient’s values (Indian Food Composition Tables 2017 where available) and the amounts you entered. “No data” means at
            least one ingredient has no value for that nutrient.
          </p>

          <section className="calc-save">
            <strong>Save to the food list</strong>
            <p className="muted-note">So you can log it in meals. You can edit its category and ingredients later in ☰ → Food list.</p>
            <div className="recipe-row-amount">
              <input type="text" aria-label="Recipe name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Recipe name, e.g. Dry fruit laddoo" />
              <button
                type="button"
                className="primary"
                disabled={!name.trim() || saving || result.withoutData.length > 0}
                onClick={async () => {
                  setSaving(true)
                  setMessage(null)
                  try {
                    const groups = [...new Set(recipe!.ingredients.flatMap((item) => byId.get(item.foodId)?.groups ?? []))] as FoodGroup[]
                    await onSaveFood({
                      id: `custom-${crypto.randomUUID()}`,
                      name: name.trim(),
                      aliases: [],
                      category: 'snacks',
                      groups,
                      defaultUnit: recipe!.pieces ? 'pieces' : 'g',
                      defaultQty: recipe!.pieces ? 1 : 100,
                      unitGrams: result.pieceGrams ? { pieces: Math.round(result.pieceGrams * 10) / 10 } : {},
                      nutrients: result.per100,
                      nutrientSource: 'recipe',
                      sourceNote: '',
                      ingredients: [...new Set(recipe!.ingredients.map((item) => item.foodId))],
                      isCustom: true,
                      isReference: false,
                      recipe,
                    })
                    setMessage(`Saved “${name.trim()}”. Find it when logging a meal or in ☰ → Food list.`)
                    setName('')
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Could not save the recipe')
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {message && <p className="muted-note" role="status">{message}</p>}
          </section>
        </>
      )}
    </div>
  )
}

/** A standalone calorie and nutrient calculator for a food or a home recipe. Nothing is logged. */
export function CalorieCalculator({
  foods,
  settings,
  onSaveFood,
  onClose,
}: {
  foods: FoodEntry[]
  settings: Settings
  onSaveFood: (food: FoodEntry) => Promise<unknown>
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>('food')
  return (
    <>
      <div className="date-nav">
        <div className="date-nav-copy">
          <h2>Calorie calculator</h2>
          <div className="sub">Work out calories and nutrients — nothing is added to the diary</div>
        </div>
        <button type="button" className="ghost calc-close" onClick={onClose}>Done</button>
      </div>
      <div className="segmented" role="tablist" aria-label="Calculate for">
        {([
          ['food', 'A food'],
          ['recipe', 'A recipe'],
        ] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>
            {label}
          </button>
        ))}
      </div>
      <section className="section">
        {mode === 'food' ? <FoodCalculator foods={foods} settings={settings} /> : <RecipeCalculator foods={foods} onSaveFood={onSaveFood} />}
      </section>
      <p className="disclaimer">Estimates from food composition data and the amounts entered — not a medical or dietary assessment.</p>
    </>
  )
}
