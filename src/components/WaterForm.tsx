import { useState } from 'react'
import { nowTime } from '../dates'
import type { WaterEntry, WaterUnit } from '../types'
import { WATER_PRESETS_ML, WATER_UNITS, formatTotalMl, totalWaterMl, waterMl } from '../water'

export function WaterForm({
  date,
  initial,
  logged = [],
  onSave,
  onDelete,
  onCancel,
}: {
  date: string
  initial?: WaterEntry
  logged?: WaterEntry[]
  onSave: (entry: WaterEntry) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  // Editing keeps the entry's own day (it may be opened from another day, e.g. the timeline).
  const day = initial?.date ?? date
  const [time, setTime] = useState(initial?.time ?? nowTime())
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [unit, setUnit] = useState<WaterUnit>(initial?.unit ?? 'ml')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const parsed = Number(amount)
  // 0 is valid: it records that no water was drunk, which the calendar shows as 0 ml rather than a dash.
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed >= 0
  const alreadyMl = totalWaterMl(logged.filter((item) => item.id !== initial?.id && item.date === day))
  const thisMl = valid ? waterMl({ amount: parsed, unit }) : 0
  const totalMl = alreadyMl + thisMl

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid) return
        onSave({
          id: initial?.id ?? crypto.randomUUID(),
          date: day,
          time,
          amount: parsed,
          unit,
          notes: notes.trim(),
        })
      }}
    >
      <label className="field">
        <span>Time</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>

      <div>
        <span className="field-label">How much water?</span>
        <p className="muted-note" style={{ margin: '2px 0 8px' }}>Plain water only — log milk, juice and other drinks as foods in a meal.</p>
        <div className="qty-row">
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 150"
            required
          />
          <div className="choice-row units">
            {WATER_UNITS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`choice ${unit === item.id ? 'selected' : ''}`}
                onClick={() => setUnit(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(alreadyMl > 0 || valid) && (
        <div className="water-total">
          <span>Total water consumption</span>
          <strong>{formatTotalMl(totalMl)}</strong>
        </div>
      )}

      {unit === 'ml' && (
        <div>
          <span className="field-label">Quick amounts</span>
          <div className="choice-row" style={{ marginTop: 8 }}>
            {WATER_PRESETS_ML.map((ml) => (
              <button
                key={ml}
                type="button"
                className={`choice ${unit === 'ml' && amount === String(ml) ? 'selected' : ''}`}
                onClick={() => {
                  setUnit('ml')
                  setAmount(String(ml))
                }}
              >
                {ml} ml
              </button>
            ))}
            <button
              type="button"
              className={`choice ${unit === 'ml' && amount === '0' ? 'selected' : ''}`}
              title="Record that no water was drunk"
              onClick={() => {
                setUnit('ml')
                setAmount('0')
              }}
            >
              None (0 ml)
            </button>
          </div>
        </div>
      )}

      <label className="field">
        <span>Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Sippy cup, after play, with meal..."
        />
      </label>
      <div className="actions">
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!valid}>
          Save water
        </button>
      </div>
    </form>
  )
}
