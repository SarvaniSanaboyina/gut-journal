import { useMemo, useState } from 'react'
import { formatDate, todayISO } from '../dates'
import {
  ageInDays,
  growthAssessments,
  curveValue,
  formatZ,
  growthNotes,
  INDICATORS,
  PERCENTILE_LINES,
  WHO_MAX_DAYS,
  type GrowthAssessment,
  type Indicator,
} from '../growth'
import { formatAge } from '../nutrition'
import type { ChildProfile, GrowthEntry, JournalData, MeasurePosition } from '../types'
import { GrowthChart } from './Charts'
import { Modal } from './Modal'

const DAYS_PER_MONTH = 30.4375

function formatAgeDays(days: number) {
  return formatAge(Math.floor(days / DAYS_PER_MONTH))
}

export function GrowthForm({
  initial,
  profile,
  onSave,
  onDelete,
  onCancel,
}: {
  initial?: GrowthEntry
  profile: ChildProfile
  onSave: (entry: GrowthEntry) => Promise<void>
  onDelete?: () => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [weight, setWeight] = useState(initial?.weightKg != null ? String(initial.weightKg) : '')
  const [height, setHeight] = useState(initial?.heightCm != null ? String(initial.heightCm) : '')
  const defaultPosition: MeasurePosition = profile.birthDate ? (ageInDays(profile.birthDate, date) < 731 ? 'lying' : 'standing') : ''
  const [position, setPosition] = useState<MeasurePosition | null>(initial ? initial.position : null)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chosenPosition = position ?? defaultPosition

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault()
        const weightKg = weight.trim() === '' ? null : Number(weight)
        const heightCm = height.trim() === '' ? null : Number(height)
        if (weightKg == null && heightCm == null) return setError('Enter a weight, a height, or both')
        if (weightKg != null && (!Number.isFinite(weightKg) || weightKg < 1 || weightKg > 60)) return setError('Weight should be in kilograms, between 1 and 60')
        if (heightCm != null && (!Number.isFinite(heightCm) || heightCm < 40 || heightCm > 150)) return setError('Height should be in centimetres, between 40 and 150')
        setSaving(true)
        setError(null)
        try {
          await onSave({
            id: initial?.id ?? crypto.randomUUID(),
            date,
            weightKg,
            heightCm,
            position: heightCm == null ? '' : chosenPosition,
            notes: notes.trim(),
          })
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Could not save the measurement')
        } finally {
          setSaving(false)
        }
      }}
    >
      <label className="field">
        <span>Date measured</span>
        <input type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value || todayISO())} />
      </label>
      <div className="time-pair">
        <label className="field">
          <span>Weight (kg)</span>
          <input type="number" min="1" max="60" step="0.01" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="e.g. 11.2" />
        </label>
        <label className="field">
          <span>Height / length (cm)</span>
          <input type="number" min="40" max="150" step="0.1" inputMode="decimal" value={height} onChange={(event) => setHeight(event.target.value)} placeholder="e.g. 84.5" />
        </label>
      </div>
      {height.trim() !== '' && (
        <div>
          <span className="field-label">How was height measured?</span>
          <div className="choice-row" style={{ marginTop: 8 }}>
            {([
              ['lying', 'Lying down (length)'],
              ['standing', 'Standing (height)'],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={chosenPosition === id} className={`choice ${chosenPosition === id ? 'selected' : ''}`} onClick={() => setPosition(id)}>
                {label}
              </button>
            ))}
          </div>
          <p className="muted-note" style={{ margin: '6px 0 0' }}>WHO charts use lying length under 2 years and standing height from 2 years. A different method is corrected by 0.7 cm.</p>
        </div>
      )}
      <label className="field">
        <span>Notes</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Clinic scale, with clothes, after illness…" />
      </label>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="actions">
        {onDelete && <button type="button" className="danger" onClick={onDelete}>Delete</button>}
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save measurement'}</button>
      </div>
    </form>
  )
}

function ProfileQuickForm({ profile, onSave }: { profile: ChildProfile; onSave: (profile: ChildProfile) => Promise<void> }) {
  const [birthDate, setBirthDate] = useState(profile.birthDate)
  const [sex, setSex] = useState(profile.sex)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="profile-quick"
      onSubmit={async (event) => {
        event.preventDefault()
        try {
          await onSave({ birthDate, sex })
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Could not save')
        }
      }}
    >
      <p>Percentiles need the child’s date of birth and sex — WHO curves differ for girls and boys.</p>
      <div className="time-pair">
        <label className="field">
          <span>Date of birth</span>
          <input type="date" value={birthDate} max={todayISO()} onChange={(event) => setBirthDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Sex</span>
          <select value={sex} onChange={(event) => setSex(event.target.value as ChildProfile['sex'])}>
            <option value="">Not set</option>
            <option value="female">Girl</option>
            <option value="male">Boy</option>
          </select>
        </label>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      <button type="submit" className="primary" disabled={!birthDate || !sex}>Save profile</button>
    </form>
  )
}

function ScoreCell({ value, unit, digits = 1 }: { value: GrowthAssessment['weight']; unit: string; digits?: number }) {
  if (!value) return <span className="muted-note">—</span>
  return (
    <>
      <strong>{value.value.toFixed(digits)} {unit}</strong>
      <small>{value.percentile} percentile · z {formatZ(value.z)}</small>
    </>
  )
}

export function GrowthView({
  data,
  onSave,
  onDelete,
  onSaveProfile,
}: {
  data: JournalData
  onSave: (entry: GrowthEntry) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSaveProfile: (profile: ChildProfile) => Promise<void>
}) {
  const profile = data.settings.childProfile
  const [editing, setEditing] = useState<{ entry?: GrowthEntry } | null>(null)
  const [indicator, setIndicator] = useState<Indicator>('weight')
  const assessments = useMemo(() => growthAssessments(data), [data])
  const notes = useMemo(() => growthNotes(assessments), [assessments])
  const usable = assessments.filter((item) => !item.unavailable && item[indicator])
  const latest = [...assessments].reverse().find((item) => !item.unavailable)
  const profileReady = Boolean(profile.birthDate && profile.sex)

  const chart = useMemo(() => {
    if (!profileReady || usable.length === 0 || profile.sex === '') return null
    const sex = profile.sex
    const ages = usable.map((item) => item.ageDays / DAYS_PER_MONTH)
    const x0 = Math.max(0, Math.floor(Math.min(...ages) - 3))
    const x1 = Math.min(WHO_MAX_DAYS / DAYS_PER_MONTH, Math.ceil(Math.max(...ages) + 3))
    const samples: number[] = []
    for (let m = x0; m <= x1 + 1e-9; m += 0.5) samples.push(Math.min(m, x1))
    const curves = PERCENTILE_LINES.map((line) => ({
      label: line.label,
      emphasis: line.z === 0,
      points: samples.map((m) => [m, curveValue(indicator, sex, Math.round(m * DAYS_PER_MONTH), line.z)] as [number, number]),
    }))
    const meta = INDICATORS[indicator]
    const digits = indicator === 'weight' ? 2 : 1
    return {
      x0,
      x1,
      curves,
      points: usable.map((item) => {
        const value = item[indicator]!
        return {
          key: item.entry.id,
          x: item.ageDays / DAYS_PER_MONTH,
          y: value.value,
          full: `${formatDate(item.entry.date)} · ${formatAgeDays(item.ageDays)}`,
          detail: `${value.value.toFixed(digits)} ${meta.unit} · ${value.percentile} percentile`,
        }
      }),
      rows: usable.map((item) => {
        const value = item[indicator]!
        return [formatDate(item.entry.date), formatAgeDays(item.ageDays), `${value.value.toFixed(digits)} ${meta.unit}`, value.percentile, formatZ(value.z)]
      }),
    }
  }, [indicator, profile.sex, profileReady, usable])

  return (
    <>
      <div className="quick-log one">
        <button type="button" onClick={() => setEditing({})}><span className="qi" aria-hidden="true">📏</span>Add weight / height</button>
      </div>

      {!profileReady && <ProfileQuickForm profile={profile} onSave={onSaveProfile} />}

      {latest && (
        <div className="stat-tiles">
          <div className="stat-tile"><span>Latest</span><strong>{formatDate(latest.entry.date)}</strong><small>{formatAgeDays(latest.ageDays)}</small></div>
          <div className="stat-tile"><span>Weight</span><strong>{latest.weight ? `${latest.weight.value} kg` : '—'}</strong><small>{latest.weight ? `${latest.weight.percentile} percentile` : ''}</small></div>
          <div className="stat-tile"><span>Height</span><strong>{latest.entry.heightCm != null ? `${latest.entry.heightCm} cm` : '—'}</strong><small>{latest.height ? `${latest.height.percentile} percentile` : ''}</small></div>
          <div className="stat-tile"><span>BMI</span><strong>{latest.bmi ? latest.bmi.value.toFixed(1) : '—'}</strong><small>{latest.bmi ? `${latest.bmi.percentile} percentile` : ''}</small></div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="care-notices" role="status">
          {notes.map((note) => (
            <div key={note} className="care-notice discuss"><strong>Worth discussing</strong><p>{note}</p></div>
          ))}
        </div>
      )}

      {data.growth.length > 0 && profileReady && (
        <section className="section">
          <div className="segmented small" role="tablist" aria-label="Growth measure">
            {(Object.keys(INDICATORS) as Indicator[]).map((key) => (
              <button key={key} role="tab" aria-selected={indicator === key} className={indicator === key ? 'active' : ''} onClick={() => setIndicator(key)}>
                {INDICATORS[key].short}
              </button>
            ))}
          </div>
          {chart ? (
            <GrowthChart
              title={INDICATORS[indicator].label}
              subtitle={`WHO Child Growth Standards, ${profile.sex === 'female' ? 'girls' : 'boys'} · lines show the 3rd–97th percentiles`}
              unit={INDICATORS[indicator].unit}
              xDomain={[chart.x0, chart.x1]}
              curves={chart.curves}
              points={chart.points}
              table={{ head: ['Date', 'Age', INDICATORS[indicator].short, 'Percentile', 'z-score'], rows: chart.rows }}
            />
          ) : (
            <div className="empty">{indicator === 'bmi' ? 'BMI needs weight and height measured on the same day.' : `No ${INDICATORS[indicator].short.toLowerCase()} recorded between birth and 5 years.`}</div>
          )}
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Measurements</h3>
            <p>Tap a row to edit</p>
          </div>
        </div>
        {assessments.length === 0 ? (
          <div className="empty">No measurements yet. Add weights and heights from clinic visits or home checks to see them on the WHO growth curves.</div>
        ) : (
          <div className="growth-table" role="table" aria-label="Growth measurements">
            {[...assessments].reverse().map((item) => (
              <button key={item.entry.id} type="button" className="growth-row" role="row" onClick={() => setEditing({ entry: item.entry })}>
                <span role="cell">
                  <strong>{formatDate(item.entry.date)}</strong>
                  <small>{item.ageDays >= 0 ? formatAgeDays(item.ageDays) : ''}</small>
                </span>
                <span role="cell"><ScoreCell value={item.weight} unit="kg" digits={2} />{!item.weight && item.entry.weightKg != null && <strong>{item.entry.weightKg} kg</strong>}</span>
                <span role="cell">
                  {item.entry.heightCm != null ? <strong>{item.entry.heightCm.toFixed(1)} cm</strong> : <span className="muted-note">—</span>}
                  {item.height && <small>{item.height.percentile} percentile · z {formatZ(item.height.z)}</small>}
                  {item.heightNote && <small title={item.heightNote}>{item.entry.position === 'standing' ? 'standing, +0.7 cm for chart' : 'lying, −0.7 cm for chart'}</small>}
                </span>
                {item.unavailable && <span role="cell" className="muted-note growth-unavailable">{item.unavailable}</span>}
              </button>
            ))}
          </div>
        )}
        <p className="muted-note">
          Percentiles compare one measurement with the WHO Child Growth Standards (0–5 years). A single reading says little on its own —
          the trend over several visits, measured the same way, is what your pediatrician looks at.
        </p>
      </section>

      {editing && (
        <Modal title={editing.entry ? 'Edit measurement' : 'Add weight / height'} onClose={() => setEditing(null)}>
          <GrowthForm
            initial={editing.entry}
            profile={profile}
            onSave={(entry) => onSave(entry).then(() => setEditing(null))}
            onDelete={
              editing.entry
                ? () => {
                    if (!window.confirm('Delete this measurement?')) return
                    onDelete(editing.entry!.id).then(() => setEditing(null)).catch((error) => window.alert(error instanceof Error ? error.message : 'Could not delete'))
                  }
                : undefined
            }
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </>
  )
}
