import { useMemo, useState } from 'react'
import { categoryMeta, COMMON_FOOD_IDS, FOOD_CATEGORIES, searchFoods } from '../foods'
import type { FoodCategory, FoodEntry } from '../types'

/**
 * Tap-first food chooser: search box, recent/common shelf, then category shelves.
 * `selected` foods show a tick; tapping them again removes them.
 */
export function FoodPicker({
  foods,
  recent,
  selected,
  onPick,
  onCreate,
  placeholder = 'Search foods — idli, dal, banana…',
  compact = false,
}: {
  foods: FoodEntry[]
  recent: FoodEntry[]
  selected: Set<string>
  onPick: (food: FoodEntry) => void
  onCreate: (name: string) => void
  placeholder?: string
  compact?: boolean
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FoodCategory | 'recent'>(recent.length ? 'recent' : 'cereals')
  const results = useMemo(() => searchFoods(foods, query, 14), [foods, query])
  const common = useMemo(() => {
    const byId = new Map(foods.map((food) => [food.id, food]))
    return COMMON_FOOD_IDS.map((id) => byId.get(id)).filter((food): food is FoodEntry => Boolean(food))
  }, [foods])
  const shelf = useMemo(() => {
    if (category === 'recent') return recent.length ? recent : common
    return foods
      .filter((food) => food.category === category)
      .sort((a, b) => Number(b.isCustom) - Number(a.isCustom) || a.name.localeCompare(b.name))
  }, [category, common, foods, recent])
  const trimmed = query.trim()
  const exact = results.some((food) => food.name.toLowerCase() === trimmed.toLowerCase())

  const chip = (food: FoodEntry) => {
    const isSelected = selected.has(food.id)
    return (
      <button
        key={food.id}
        type="button"
        className={`food-chip ${isSelected ? 'selected' : ''}`}
        aria-pressed={isSelected}
        onClick={() => {
          onPick(food)
          if (trimmed) setQuery('')
        }}
      >
        <span aria-hidden="true">{isSelected ? '✓' : categoryMeta(food.category).icon}</span>
        {food.name}
        {food.isCustom && <small>mine</small>}
      </button>
    )
  }

  return (
    <div className={`food-picker ${compact ? 'compact' : ''}`}>
      <input
        type="search"
        className="food-search"
        value={query}
        placeholder={placeholder}
        aria-label="Search foods"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          if (results[0]) {
            onPick(results[0])
            setQuery('')
          } else if (trimmed) {
            onCreate(trimmed)
            setQuery('')
          }
        }}
      />

      {trimmed ? (
        <div className="food-chips" role="list">
          {results.map(chip)}
          {!exact && (
            <button
              type="button"
              className="food-chip add-new"
              onClick={() => {
                onCreate(trimmed)
                setQuery('')
              }}
            >
              + Add “{trimmed}” as a new food
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="shelf-tabs" role="tablist" aria-label="Food categories">
            <button
              type="button"
              role="tab"
              aria-selected={category === 'recent'}
              className={category === 'recent' ? 'active' : ''}
              onClick={() => setCategory('recent')}
            >
              {recent.length ? 'Recent' : 'Common'}
            </button>
            {FOOD_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={category === item.id}
                className={category === item.id ? 'active' : ''}
                onClick={() => setCategory(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span> {compact ? item.label.split(' ')[0] : item.label}
              </button>
            ))}
          </div>
          <div className="food-chips" role="list">
            {shelf.map(chip)}
            {shelf.length === 0 && <span className="muted-note">No foods here yet. Search to add one.</span>}
          </div>
        </>
      )}
    </div>
  )
}
