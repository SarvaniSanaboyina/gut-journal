import { useState } from 'react'
import { MOODS } from '../constants'
import { nowTime } from '../dates'
import type { MoodEntry, MoodKind } from '../types'
import { MoodFace } from './Icons'

export function MoodForm({
  date,
  initial,
  onSave,
  onDelete,
  onCancel,
}: {
  date: string
  initial?: MoodEntry
  onSave: (entry: MoodEntry) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [time, setTime] = useState(initial?.time ?? nowTime())
  const [mood, setMood] = useState<MoodKind>(initial?.mood ?? 'happy')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          id: initial?.id ?? crypto.randomUUID(),
          date,
          time,
          mood,
          notes: notes.trim(),
        })
      }}
    >
      <label className="field">
        <span>Time</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>
      <div className="choice-grid moods">
        {MOODS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`choice ${mood === item.id ? 'selected' : ''}`}
            onClick={() => setMood(item.id)}
          >
            <MoodFace mood={item.id} />
            <strong style={{ display: 'block', marginTop: 6 }}>{item.label}</strong>
            <small>{item.caption}</small>
          </button>
        ))}
      </div>
      <label className="field">
        <span>Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="After lunch, before nap, extra clingy..."
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
        <button type="submit" className="primary">
          Save mood
        </button>
      </div>
    </form>
  )
}
