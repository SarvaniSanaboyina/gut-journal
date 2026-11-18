import { useState } from 'react'
import type { DailyMetricEntry, Level } from '../types'

const LEVELS: { id: Exclude<Level, ''>; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
]

function LevelPicker({ label, value, onChange }: { label: string; value: Level; onChange: (value: Level) => void }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="choice-row" style={{ marginTop: 8 }}>
        {LEVELS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={value === item.id}
            className={`choice ${value === item.id ? 'selected' : ''}`}
            onClick={() => onChange(value === item.id ? '' : item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Once-a-day appetite, energy, sleep and digestion check-in. */
export function CheckInForm({
  date,
  initial,
  onSave,
  onCancel,
}: {
  date: string
  initial?: DailyMetricEntry
  onSave: (entry: DailyMetricEntry) => Promise<void>
  onCancel: () => void
}) {
  const [appetite, setAppetite] = useState<Level>(initial?.appetite ?? '')
  const [energy, setEnergy] = useState<Level>(initial?.energy ?? '')
  const [sleep, setSleep] = useState(initial?.sleepHours != null ? String(initial.sleepHours) : '')
  const [digestion, setDigestion] = useState(initial?.digestionNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault()
        const sleepHours = sleep.trim() === '' ? null : Number(sleep)
        if (sleepHours != null && (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 24)) {
          setError('Sleep must be between 0 and 24 hours')
          return
        }
        setSaving(true)
        setError(null)
        try {
          await onSave({ date, appetite, energy, sleepHours, digestionNotes: digestion.trim() })
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Could not save the check-in')
        } finally {
          setSaving(false)
        }
      }}
    >
      <LevelPicker label="Appetite today" value={appetite} onChange={setAppetite} />
      <LevelPicker label="Energy today" value={energy} onChange={setEnergy} />
      <label className="field">
        <span>Sleep in the last 24 hours (hours, including naps)</span>
        <input type="number" min="0" max="24" step="0.5" inputMode="decimal" value={sleep} onChange={(event) => setSleep(event.target.value)} placeholder="e.g. 11.5" />
      </label>
      <label className="field">
        <span>Digestion today</span>
        <textarea value={digestion} onChange={(event) => setDigestion(event.target.value)} placeholder="Comfortable, a bit gassy after lunch, burping…" />
      </label>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="actions">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save check-in'}</button>
      </div>
    </form>
  )
}
