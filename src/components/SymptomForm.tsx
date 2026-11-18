import { useMemo, useState } from 'react'
import { formatTime, nowTime } from '../dates'
import { eatenFoods } from '../foods'
import { mealLabel } from '../constants'
import { DURATIONS, formatGap, mealsBefore, previousSimilar, SEVERITIES, SYMPTOMS } from '../gut'
import type { JournalData, ReactionEntry, Severity, SymptomEntry, SymptomType } from '../types'

type Suspect = Omit<ReactionEntry, 'id' | 'severity'> & { key: string; id?: string }

const WINDOW_HOURS = 24

export function SymptomForm({
  date: initialDate,
  initial,
  data,
  onSave,
  onDelete,
  onCancel,
}: {
  date: string
  initial?: SymptomEntry
  data: JournalData
  onSave: (entries: SymptomEntry[]) => Promise<void>
  onDelete?: () => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? initialDate)
  const [time, setTime] = useState(initial?.time ?? nowTime())
  const [types, setTypes] = useState<SymptomType[]>(initial ? [initial.type] : [])
  const [otherLabel, setOtherLabel] = useState(initial?.otherLabel ?? '')
  const [severity, setSeverity] = useState<Severity>(initial?.severity ?? 'mild')
  const [duration, setDuration] = useState<number | null>(initial?.durationMinutes ?? null)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [suspects, setSuspects] = useState<Suspect[]>(
    () => initial?.reactions.map((reaction) => ({ ...reaction, key: reaction.foodId ?? `name:${reaction.foodName.toLowerCase()}` })) ?? [],
  )
  const [showFoods, setShowFoods] = useState(Boolean(initial?.reactions.length))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const before = useMemo(() => mealsBefore(data.meals, { date, time }, WINDOW_HOURS), [data.meals, date, time])
  const firstType = types[0]

  const toggleSuspect = (suspect: Suspect) => {
    setSuspects((prev) =>
      prev.some((item) => item.key === suspect.key)
        ? prev.filter((item) => item.key !== suspect.key)
        : [...prev, suspect],
    )
  }

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!types.length || saving) return
        if (types.includes('other') && !otherLabel.trim()) {
          setError('Describe the other symptom')
          return
        }
        setSaving(true)
        setError(null)
        try {
          await onSave(
            types.map((type, index) => ({
              id: index === 0 && initial ? initial.id : crypto.randomUUID(),
              date,
              time,
              type,
              otherLabel: type === 'other' ? otherLabel.trim() : '',
              severity,
              durationMinutes: duration,
              notes: notes.trim(),
              reactions: suspects.map(({ key: _key, id: existingId, ...suspect }) => ({
                ...suspect,
                id: index === 0 && existingId ? existingId : crypto.randomUUID(),
                severity,
              })),
            })),
          )
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Could not save the symptom')
        } finally {
          setSaving(false)
        }
      }}
    >
      <div>
        <span className="field-label">{initial ? 'Symptom' : 'What did you notice? (pick all that apply)'}</span>
        <div className="choice-grid symptoms" style={{ marginTop: 8 }}>
          {SYMPTOMS.map((item) => {
            const on = types.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                className={`choice ${on ? 'selected' : ''}`}
                onClick={() => {
                  if (initial) setTypes([item.id])
                  else setTypes(on ? types.filter((type) => type !== item.id) : [...types, item.id])
                }}
              >
                <span aria-hidden="true">{item.icon}</span> {item.label}
              </button>
            )
          })}
        </div>
      </div>
      {types.includes('other') && (
        <label className="field">
          <span>Other symptom</span>
          <input type="text" value={otherLabel} onChange={(event) => setOtherLabel(event.target.value)} placeholder="e.g. hiccups, rash around mouth" required />
        </label>
      )}

      <div className="time-pair">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label className="field">
          <span>Started at</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
        </label>
      </div>

      <div>
        <span className="field-label">How bad?</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {SEVERITIES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={severity === item.id}
              className={`choice severity-${item.id} ${severity === item.id ? 'selected' : ''}`}
              onClick={() => setSeverity(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="field-label">How long did it last?</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {DURATIONS.map((item) => (
            <button
              key={item.minutes}
              type="button"
              aria-pressed={duration === item.minutes}
              className={`choice small ${duration === item.minutes ? 'selected' : ''}`}
              onClick={() => setDuration(duration === item.minutes ? null : item.minutes)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Notes (optional)</span>
        <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Where it hurt, what helped…" />
      </label>

      <div className="suspect-box">
        <button type="button" className="link-btn" aria-expanded={showFoods} onClick={() => setShowFoods(!showFoods)}>
          {showFoods ? 'Hide foods eaten before' : `Suspect a food? See what was eaten in the ${WINDOW_HOURS} h before`}
          {suspects.length > 0 && ` (${suspects.length} marked)`}
        </button>
        {showFoods && (
          <div className="form-grid">
            <p className="muted-note" style={{ margin: 0 }}>
              Marking a food records a possible link to keep watching — it does not mean the food caused this.
            </p>
            {before.length === 0 && <div className="empty">No meals logged in the {WINDOW_HOURS} hours before this time.</div>}
            {before.map(({ meal, gap }) => (
              <div key={meal.id} className="suspect-meal">
                <div className="suspect-meal-head">
                  {mealLabel(meal.type)} · {formatTime(meal.time)}
                  {meal.date !== date ? ' (day before)' : ''} <small>{formatGap(gap)} before</small>
                </div>
                <div className="food-chips">
                  {(meal.items.length ? eatenFoods(meal) : [{ key: `name:${meal.foods.toLowerCase()}`, name: meal.foods, foodId: null }]).map((food) => {
                    const on = suspects.some((item) => item.key === food.key)
                    const earlier = firstType ? previousSimilar(data, { id: initial?.id ?? '', date, time, type: firstType }, food.key) : 0
                    return (
                      <button
                        key={food.key}
                        type="button"
                        aria-pressed={on}
                        className={`food-chip ${on ? 'selected' : ''}`}
                        onClick={() =>
                          toggleSuspect({
                            key: food.key,
                            foodId: food.foodId,
                            mealId: meal.id,
                            foodName: food.name,
                            consumedDate: meal.date,
                            consumedTime: meal.time,
                            previousSimilar: earlier > 0 ? 'yes' : 'unsure',
                            notes: '',
                          })
                        }
                      >
                        {on ? '✓ ' : ''}
                        {food.name}
                        {earlier > 0 && <small>marked {earlier}× before</small>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {suspects.map((suspect) => (
              <div key={suspect.key} className="suspect-row">
                <span>Has {suspect.foodName.toLowerCase()} been followed by something similar before?</span>
                <div className="choice-row compact">
                  {(['yes', 'no', 'unsure'] as const).map((answer) => (
                    <button
                      key={answer}
                      type="button"
                      aria-pressed={suspect.previousSimilar === answer}
                      className={`choice small ${suspect.previousSimilar === answer ? 'selected' : ''}`}
                      onClick={() =>
                        setSuspects((prev) => prev.map((item) => (item.key === suspect.key ? { ...item, previousSimilar: answer } : item)))
                      }
                    >
                      {answer === 'unsure' ? 'Not sure' : answer === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {severity === 'severe' && (
        <div className="alert urgent" role="status">
          Severe symptoms need prompt medical advice — contact your pediatrician, especially with fever, repeated vomiting or signs of dehydration.
        </div>
      )}
      {error && <div className="alert" role="alert">{error}</div>}

      <div className="actions">
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>Delete</button>
        )}
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving || types.length === 0}>
          {saving ? 'Saving…' : types.length > 1 ? `Save ${types.length} symptoms` : 'Save symptom'}
        </button>
      </div>
    </form>
  )
}
