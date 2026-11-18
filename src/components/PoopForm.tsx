import { useState } from 'react'
import { STOOL_AMOUNTS, STOOL_COLORS, stoolColorMeta } from '../constants'
import { nowTime } from '../dates'
import { BRISTOL_GROUPS, BRISTOL_TYPES } from '../gut'
import { compressImage, deletePhoto, putPhoto } from '../photos'
import type { BristolType, PoopEntry, StoolAmount, StoolColor } from '../types'
import { StoolArt } from './Icons'
import { PhotoSlot } from './MealPhotos'

export function PoopForm({
  date: initialDate,
  initial,
  sameDay = 0,
  onSave,
  onDelete,
  onCancel,
}: {
  date: string
  initial?: PoopEntry
  /** Bowel movements already logged on this day (excluding this one). */
  sameDay?: number
  onSave: (entry: PoopEntry) => Promise<void>
  onDelete?: () => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? initialDate)
  const [time, setTime] = useState(initial?.time ?? nowTime())
  const [bristol, setBristol] = useState<BristolType>(initial?.bristol ?? 4)
  const [color, setColor] = useState<StoolColor>(initial?.color ?? 'brown')
  const [amount, setAmount] = useState<StoolAmount>(initial?.amount ?? 'medium')
  const [straining, setStraining] = useState(initial?.straining ?? false)
  const [pain, setPain] = useState(initial?.pain ?? false)
  const [mucus, setMucus] = useState(initial?.mucus ?? false)
  const [visibleBlood, setVisibleBlood] = useState(initial?.visibleBlood ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [photo, setPhoto] = useState<File | 'keep' | 'remove'>('keep')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const colorMeta = stoolColorMeta(color)
  const needsDoctor = visibleBlood || color === 'red' || color === 'black' || color === 'pale'

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault()
        if (saving) return
        const id = initial?.id ?? crypto.randomUUID()
        setSaving(true)
        setError(null)
        try {
          let hasPhoto = initial?.hasPhoto ?? false
          if (photo instanceof File) {
            await putPhoto(id, 'stool', await compressImage(photo).catch(() => photo))
            hasPhoto = true
          } else if (photo === 'remove') {
            await deletePhoto(id, 'stool')
            hasPhoto = false
          }
          await onSave({
            id,
            date,
            time,
            bristol,
            color,
            amount,
            straining,
            pain,
            mucus,
            visibleBlood,
            hasPhoto,
            notes: notes.trim(),
          })
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Could not save the bowel movement')
        } finally {
          setSaving(false)
        }
      }}
    >
      <div className="time-pair">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label className="field">
          <span>Time</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
        </label>
      </div>
      {!initial && (
        <div className="muted-note">
          {sameDay === 0 ? 'First bowel movement logged for this day.' : `Bowel movement number ${sameDay + 1} on this day.`}
        </div>
      )}

      <div>
        <span className="field-label">Bristol stool type — pick the closest picture</span>
        <div className="bristol-scale">
          {BRISTOL_GROUPS.map((group) => (
            <div key={group.id} className="bristol-group">
              <div className="bristol-group-head">
                <i style={{ background: group.color }} aria-hidden="true" />
                {group.label} <small>{group.range}</small>
              </div>
              <div className="bristol-options">
                {BRISTOL_TYPES.filter((item) => item.group === group.id).map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    aria-pressed={bristol === item.type}
                    className={`choice bristol-option ${bristol === item.type ? 'selected' : ''}`}
                    onClick={() => setBristol(item.type)}
                  >
                    <StoolArt type={item.type} />
                    <span>
                      <strong>{item.type}</strong> {item.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="field-label">Colour</span>
        <div className="choice-row" style={{ marginTop: 8 }}>
          {STOOL_COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={color === item.id}
              className={`choice ${color === item.id ? 'selected' : ''}`}
              onClick={() => setColor(item.id)}
            >
              <i className="color-dot" style={{ background: item.swatch }} /> {item.label}
            </button>
          ))}
        </div>
      </div>

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

      <div>
        <span className="field-label">Anything else?</span>
        <div className="checks" style={{ marginTop: 8 }}>
          <label>
            <input type="checkbox" checked={straining} onChange={(event) => setStraining(event.target.checked)} />
            Straining
          </label>
          <label>
            <input type="checkbox" checked={pain} onChange={(event) => setPain(event.target.checked)} />
            Pain
          </label>
          <label>
            <input type="checkbox" checked={mucus} onChange={(event) => setMucus(event.target.checked)} />
            Mucus
          </label>
          <label>
            <input type="checkbox" checked={visibleBlood} onChange={(event) => setVisibleBlood(event.target.checked)} />
            Visible blood
          </label>
        </div>
      </div>

      {needsDoctor && (
        <div className="alert urgent" role="status">
          {visibleBlood || color === 'red'
            ? 'Blood in stool should be checked by a doctor. Please contact your pediatrician.'
            : `${colorMeta.label} stool should be checked by a doctor. Please contact your pediatrician.`}
        </div>
      )}

      <div>
        <span className="field-label">Photo (optional, stays private)</span>
        <div className="photo-slots single">
          <PhotoSlot label="Photo" slot="stool" mealId={initial?.id} hasExisting={Boolean(initial?.hasPhoto)} onChange={setPhoto} />
        </div>
      </div>

      <label className="field">
        <span>Notes (optional)</span>
        <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Smell, accident, in the potty…" />
      </label>

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="actions">
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>Delete</button>
        )}
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}
