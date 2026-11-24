import { useMemo, useState } from 'react'
import { dateRange, formatLongDate, formatTime, shiftDate, todayISO } from '../dates'
import { consumedPercent, consumptionLabel, eatenFoods } from '../foods'
import { bristolGroupMeta, bristolGroup, formatGap, stamp, SYMPTOMS, symptomIcon, symptomLabel } from '../gut'
import { mealLabel as mealTypeLabel } from '../constants'
import type { JournalData, MealEntry, PoopEntry, SymptomEntry, SymptomType, WaterEntry } from '../types'
import { formatTotalMl, formatWater, totalWaterMl } from '../water'

type Event =
  | { kind: 'meal'; at: number; date: string; time: string; meal: MealEntry; match: boolean }
  | { kind: 'poop'; at: number; date: string; time: string; poop: PoopEntry; after: number | null }
  | { kind: 'symptom'; at: number; date: string; time: string; symptom: SymptomEntry; after: number | null }
  | { kind: 'water'; at: number; date: string; time: string; water: WaterEntry }

const WINDOW_HOURS = [6, 12, 24, 48] as const

function mealMatches(meal: MealEntry, query: string) {
  if (!query) return false
  const q = query.toLowerCase()
  return eatenFoods(meal).some((food) => food.name.toLowerCase().includes(q)) || meal.foods.toLowerCase().includes(q)
}

/** Food and gut events on one chronological line, with time-since-matching-food shown on gut events. */
export function TimelineView({
  data,
  onEditMeal,
  onEditPoop,
  onEditSymptom,
  onEditWater,
}: {
  data: JournalData
  onEditMeal: (entry: MealEntry) => void
  onEditPoop: (entry: PoopEntry) => void
  onEditSymptom: (entry: SymptomEntry) => void
  onEditWater: (entry: WaterEntry) => void
}) {
  const today = todayISO()
  const [end, setEnd] = useState(today)
  const [length, setLength] = useState(7)
  const [query, setQuery] = useState('')
  const [symptomFilter, setSymptomFilter] = useState<SymptomType | 'all' | 'none'>('all')
  const [windowHours, setWindowHours] = useState<(typeof WINDOW_HOURS)[number]>(24)
  const [show, setShow] = useState({ meals: true, water: true, poops: true, symptoms: true })
  const days = useMemo(() => dateRange(shiftDate(end, -(length - 1)), end), [end, length])
  const trimmed = query.trim()

  const byDay = useMemo(() => {
    const set = new Set(days)
    // Include the window before the first day so a gut event on day 1 can still point back to a meal.
    const earliest = shiftDate(days[0], -Math.ceil(windowHours / 24))
    const meals = data.meals.filter((meal) => meal.date >= earliest && meal.date <= end)
    const matchStamps = trimmed ? meals.filter((meal) => mealMatches(meal, trimmed)).map((meal) => stamp(meal.date, meal.time)) : []
    const since = (at: number) => {
      const before = matchStamps.filter((value) => value <= at && at - value <= windowHours * 3_600_000)
      return before.length ? (at - Math.max(...before)) / 60000 : null
    }
    const events: Event[] = []
    if (show.meals) {
      for (const meal of meals.filter((item) => set.has(item.date))) {
        events.push({ kind: 'meal', at: stamp(meal.date, meal.time), date: meal.date, time: meal.time, meal, match: mealMatches(meal, trimmed) })
      }
    }
    if (show.water) {
      for (const water of data.waters.filter((item) => set.has(item.date))) {
        events.push({ kind: 'water', at: stamp(water.date, water.time), date: water.date, time: water.time, water })
      }
    }
    if (show.poops) {
      for (const poop of data.poops.filter((item) => set.has(item.date))) {
        const at = stamp(poop.date, poop.time)
        events.push({ kind: 'poop', at, date: poop.date, time: poop.time, poop, after: since(at) })
      }
    }
    if (show.symptoms && symptomFilter !== 'none') {
      for (const symptom of data.symptoms.filter((item) => set.has(item.date) && (symptomFilter === 'all' || item.type === symptomFilter))) {
        const at = stamp(symptom.date, symptom.time)
        events.push({ kind: 'symptom', at, date: symptom.date, time: symptom.time, symptom, after: since(at) })
      }
    }
    const grouped = new Map<string, Event[]>()
    for (const day of [...days].reverse()) grouped.set(day, [])
    for (const event of events.sort((a, b) => a.at - b.at)) grouped.get(event.date)?.push(event)
    return grouped
  }, [data, days, end, show, symptomFilter, trimmed, windowHours])

  // Daily water totals for the day headings (shown even when water rows are hidden).
  const waterByDay = useMemo(() => {
    const totals = new Map<string, number>()
    for (const day of days) {
      const entries = data.waters.filter((item) => item.date === day)
      if (entries.length) totals.set(day, totalWaterMl(entries))
    }
    return totals
  }, [data.waters, days])

  const matchedMeals = [...byDay.values()].flat().filter((event) => event.kind === 'meal' && event.match).length
  const gutAfter = [...byDay.values()].flat().filter((event) => (event.kind === 'poop' || event.kind === 'symptom') && event.after != null).length

  return (
    <>
      <div className="filter-row">
        <label className="field">
          <span>Show</span>
          <select value={length} onChange={(event) => setLength(Number(event.target.value))}>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={31}>31 days</option>
          </select>
        </label>
        <label className="field">
          <span>Ending</span>
          <input type="date" value={end} max={today} onChange={(event) => setEnd(event.target.value || today)} />
        </label>
        <label className="field">
          <span>Symptom</span>
          <select value={symptomFilter} onChange={(event) => setSymptomFilter(event.target.value as SymptomType | 'all' | 'none')}>
            <option value="all">All symptoms</option>
            {SYMPTOMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            <option value="none">Hide symptoms</option>
          </select>
        </label>
      </div>
      <div className="filter-row">
        <label className="field grow">
          <span>Highlight a food</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. milk, ragi, banana" />
        </label>
        <label className="field">
          <span>Then look</span>
          <select value={windowHours} onChange={(event) => setWindowHours(Number(event.target.value) as (typeof WINDOW_HOURS)[number])} disabled={!trimmed}>
            {WINDOW_HOURS.map((hours) => <option key={hours} value={hours}>{hours} h after</option>)}
          </select>
        </label>
      </div>
      <div className="choice-row timeline-toggles" role="group" aria-label="Event types">
        {([
          ['meals', '🍽 Meals'],
          ['poops', '🚽 Bowel movements'],
          ['water', '💧 Water'],
          ['symptoms', '🩹 Symptoms'],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={show[key]} className={`choice ${show[key] ? 'selected' : ''}`} onClick={() => setShow({ ...show, [key]: !show[key] })}>
            {label}
          </button>
        ))}
      </div>

      {trimmed && (
        <p className="timeline-summary" role="status">
          “{trimmed}” was in <strong>{matchedMeals}</strong> meal{matchedMeals === 1 ? '' : 's'} in this view.{' '}
          <strong>{gutAfter}</strong> gut event{gutAfter === 1 ? '' : 's'} followed within {windowHours} h. A sequence in time is not proof that the food caused it.
        </p>
      )}

      <div className="timeline">
        {[...byDay.entries()].map(([day, events]) => (
          <section key={day} className="timeline-day">
            <h4>
              {formatLongDate(day)}
              {waterByDay.has(day) && <span className="tl-day-water"> · 💧 {formatTotalMl(waterByDay.get(day)!)} water</span>}
            </h4>
            {events.length === 0 ? (
              <p className="muted-note timeline-empty">Nothing logged</p>
            ) : (
              <ol>
                {events.map((event) => {
                  if (event.kind === 'meal') {
                    const foods = event.meal.items.length
                      ? event.meal.items.map((item) => {
                          const percent = consumedPercent(item)
                          return { key: item.id, name: item.name, note: percent == null ? '' : percent === 0 ? 'refused' : consumptionLabel(percent).toLowerCase(), refused: percent === 0 }
                        })
                      : [{ key: 'text', name: event.meal.foods || 'No foods listed', note: '', refused: false }]
                    return (
                      <li key={event.meal.id} className={`tl-event food ${event.match ? 'match' : ''}`}>
                        <button type="button" onClick={() => onEditMeal(event.meal)}>
                          <time>{formatTime(event.time)}</time>
                          <span className="tl-lane">Food</span>
                          <span className="tl-body">
                            <strong>{mealTypeLabel(event.meal.type)}</strong>
                            <span className="tl-foods">
                              {foods.map((food) => (
                                <span key={food.key} className={food.refused ? 'refused' : ''}>
                                  {food.name}{food.note && <small> · {food.note}</small>}
                                </span>
                              ))}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  }
                  if (event.kind === 'water') {
                    return (
                      <li key={event.water.id} className="tl-event water">
                        <button type="button" onClick={() => onEditWater(event.water)}>
                          <time>{formatTime(event.time)}</time>
                          <span className="tl-lane">Water</span>
                          <span className="tl-body">
                            <strong>Water · {formatWater(event.water.amount, event.water.unit)}</strong>
                            {event.water.notes && <small>{event.water.notes}</small>}
                          </span>
                        </button>
                      </li>
                    )
                  }
                  if (event.kind === 'poop') {
                    const group = bristolGroupMeta(bristolGroup(event.poop.bristol))
                    const flags = [event.poop.straining && 'straining', event.poop.pain && 'pain', event.poop.mucus && 'mucus', event.poop.visibleBlood && 'blood'].filter(Boolean)
                    return (
                      <li key={event.poop.id} className="tl-event gut">
                        <button type="button" onClick={() => onEditPoop(event.poop)}>
                          <time>{formatTime(event.time)}</time>
                          <span className="tl-lane">Gut</span>
                          <span className="tl-body">
                            <strong><i className="tl-dot" style={{ background: group.color }} />Bowel movement · type {event.poop.bristol}</strong>
                            <small>{group.label}{flags.length ? ` · ${flags.join(', ')}` : ''}</small>
                            {event.after != null && <small className="tl-after">{formatGap(event.after)} after “{trimmed}”</small>}
                          </span>
                        </button>
                      </li>
                    )
                  }
                  const linked = event.symptom.reactions
                  return (
                    <li key={event.symptom.id} className={`tl-event gut symptom ${event.symptom.severity}`}>
                      <button type="button" onClick={() => onEditSymptom(event.symptom)}>
                        <time>{formatTime(event.time)}</time>
                        <span className="tl-lane">Gut</span>
                        <span className="tl-body">
                          <strong><span aria-hidden="true">{symptomIcon(event.symptom.type)} </span>{symptomLabel(event.symptom)} <span className={`severity-pill ${event.symptom.severity}`}>{event.symptom.severity}</span></strong>
                          {linked.length > 0 && (
                            <small>
                              Suspected: {linked.map((reaction) => `${reaction.foodName} (${formatGap((stamp(event.symptom.date, event.symptom.time) - stamp(reaction.consumedDate, reaction.consumedTime)) / 60000)} before)`).join(', ')}
                            </small>
                          )}
                          {event.after != null && <small className="tl-after">{formatGap(event.after)} after “{trimmed}”</small>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
