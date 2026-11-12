import { useState } from 'react'
import { BRISTOL, STOOL_AMOUNTS, STOOL_COLORS, stoolColorMeta } from '../constants'
import { nowTime } from '../dates'
import type { BristolType, PoopEntry, StoolAmount, StoolColor } from '../types'
import { StoolArt } from './Icons'

export function PoopForm({
  date,
  initial,
  onSave,
  onDelete,
  onCancel,
}: {
  date: string
  initial?: PoopEntry
  onSave: (entry: PoopEntry) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [time, setTime] = useState(initial?.time ?? nowTime())
  const [bristol, setBristol] = useState<BristolType>(initial?.bristol ?? 4)
  const [color, setColor] = useState<StoolColor>(initial?.color ?? 'brown')
  const [amount, setAmount] = useState<StoolAmount>(initial?.amount ?? 'medium')
  const [straining, setStraining] = useState(initial?.straining ?? false)
  const [pain, setPain] = useState(initial?.pain ?? false)
  const [mucus, setMucus] = useState(initial?.mucus ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const colorMeta = stoolColorMeta(color)

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          id: initial?.id ?? crypto.randomUUID(),
          date,
          time,
          bristol,
          color,
          amount,
          straining,
          pain,
          mucus,
          notes: notes.trim(),
        })
      }}
    >
      <label className="field">
        <span>Time</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>

      <div>
        <span className="field-label">How did it look? (Bristol scale)</span>
        <div className="choice-grid bristol" style={{ marginTop: 8 }}>
          {BRISTOL.map((item) => (
            <button
              key={item.type}
              type="button"
              className={`choice ${bristol === item.type ? 'selected' : ''}`}
              onClick={() => setBristol(item.type)}
            >
              <span className="bristol-choice">
                <span className="bristol-num">{item.type}</span>
                <span>
                  {item.title}
                  <small>{item.hint}</small>
                </span>
                <StoolArt type={item.type} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="field-label">Color</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {STOOL_COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`choice ${color === item.id ? 'selected' : ''}`}
              onClick={() => setColor(item.id)}
            >
              <i className="color-dot" style={{ background: item.swatch }} /> {item.label}
            </button>
          ))}
        </div>
      </div>

      {colorMeta.alert && (
        <div className="alert">
          Unusual color. If this keeps happening, mention it to your pediatrician.
        </div>
      )}

      <div>
        <span className="field-label">Amount</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {STOOL_AMOUNTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`choice ${amount === item.id ? 'selected' : ''}`}
              onClick={() => setAmount(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="checks">
        <label>
          <input type="checkbox" checked={straining} onChange={(e) => setStraining(e.target.checked)} />
          Straining
        </label>
        <label>
          <input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} />
          Pain
        </label>
        <label>
          <input type="checkbox" checked={mucus} onChange={(e) => setMucus(e.target.checked)} />
          Mucus
        </label>
      </div>

      <label className="field">
        <span>Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Smell, accident, in the potty..."
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
          Save poop
        </button>
      </div>
    </form>
  )
}
