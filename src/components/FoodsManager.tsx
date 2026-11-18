import { useMemo, useState } from 'react'
import { categoryMeta, FOOD_CATEGORIES, groupMeta, searchFoods, unitLabel } from '../foods'
import { NUTRIENT_ORDER, NUTRIENTS } from '../nutrition'
import type { FoodCategory, FoodEntry, FoodUnit } from '../types'
import { CustomFoodForm } from './CustomFoodForm'

function SourceTag({ food }: { food: FoodEntry }) {
  if (food.nutrientSource === 'label') return <span className="tag label">From label</span>
  if (food.nutrientSource === 'catalogue') return <span className="tag estimate">Estimate</span>
  return <span className="tag missing">No nutrient data</span>
}

function FoodDetails({ food }: { food: FoodEntry }) {
  const measures = Object.entries(food.unitGrams).map(([unit, grams]) => `1 ${unitLabel(unit as FoodUnit, 1)} ≈ ${grams} g`)
  return (
    <div className="form-grid">
      <p className="muted-note" style={{ margin: 0 }}>
        {categoryMeta(food.category).label}
        {food.groups.length > 0 && ` · counts as ${food.groups.map((group) => groupMeta(group).label.toLowerCase()).join(', ')}`}
      </p>
      {measures.length > 0 && <p className="muted-note" style={{ margin: 0 }}>{measures.join(' · ')}</p>}
      <div className="insight">
        {NUTRIENT_ORDER.map((key) => (
          <div className="row" key={key}>
            <span>{NUTRIENTS[key].label}</span>
            <strong>
              {food.nutrients[key] == null ? 'no data' : `${food.nutrients[key]} ${NUTRIENTS[key].unit}`}
            </strong>
          </div>
        ))}
      </div>
      <p className="muted-note" style={{ margin: 0 }}>
        Per 100 g. {food.nutrientSource === 'catalogue'
          ? 'Approximate values from Indian (IFCT 2017) and USDA food composition tables — home recipes vary.'
          : food.nutrientSource === 'label'
            ? 'Copied from the pack label.'
            : 'No reliable values, so this food is left out of nutrient estimates.'}
      </p>
    </div>
  )
}

export function FoodsManager({
  foods,
  onSave,
  onDelete,
}: {
  foods: FoodEntry[]
  onSave: (food: FoodEntry) => Promise<unknown>
  onDelete: (id: string) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FoodCategory | 'mine' | 'all'>('all')
  const [open, setOpen] = useState<FoodEntry | 'new' | null>(null)

  const list = useMemo(() => {
    if (query.trim()) return searchFoods(foods, query, 50)
    return foods
      .filter((food) => (category === 'all' ? true : category === 'mine' ? food.isCustom : food.category === category))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [foods, query, category])

  if (open === 'new' || (open && open.isCustom)) {
    const food = open === 'new' ? undefined : open
    return (
      <CustomFoodForm
        initial={food}
        name={open === 'new' ? query.trim() : undefined}
        onCancel={() => setOpen(null)}
        onSave={async (next) => {
          await onSave(next)
          setOpen(null)
        }}
        onDelete={
          food
            ? () => {
                if (!window.confirm(`Delete ${food.name}? Past meals keep the name but lose its nutrient data.`)) return
                void onDelete(food.id).then(() => setOpen(null), (error: unknown) => {
                  window.alert(error instanceof Error ? error.message : 'Could not delete the food')
                })
              }
            : undefined
        }
      />
    )
  }

  if (open) {
    return (
      <div className="form-grid">
        <h4 className="sub-title">{open.name} <SourceTag food={open} /></h4>
        <FoodDetails food={open} />
        <div className="actions inline-actions">
          <button type="button" className="ghost" onClick={() => setOpen(null)}>Back to foods</button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-grid">
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the food list" aria-label="Search the food list" />
      {!query.trim() && (
        <div className="shelf-tabs">
          {(['all', 'mine'] as const).map((id) => (
            <button key={id} type="button" className={category === id ? 'active' : ''} onClick={() => setCategory(id)}>
              {id === 'all' ? 'All' : 'My foods'}
            </button>
          ))}
          {FOOD_CATEGORIES.map((item) => (
            <button key={item.id} type="button" className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="add-btn" style={{ justifySelf: 'start' }} onClick={() => setOpen('new')}>
        + Add a food
      </button>
      <div className="food-list">
        {list.map((food) => (
          <button key={food.id} type="button" className="food-row" onClick={() => setOpen(food)}>
            <span aria-hidden="true">{categoryMeta(food.category).icon}</span>
            <span>
              {food.name}
              <small>{food.isCustom ? 'Added by you' : categoryMeta(food.category).label}</small>
            </span>
            <SourceTag food={food} />
          </button>
        ))}
        {list.length === 0 && <div className="empty">No foods match. Add it as your own food.</div>}
      </div>
    </div>
  )
}
