import { useState } from 'react'
import { todayISO } from '../dates'
import { consumedPercent } from '../foods'
import { symptomLabel } from '../gut'
import { mealLabel } from '../constants'
import type { JournalData } from '../types'

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  // Prefix cells that a spreadsheet would treat as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function download(name: string, rows: unknown[][]) {
  const text = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}-${todayISO()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const EXPORTS: { id: string; label: string; build: (data: JournalData) => unknown[][] }[] = [
  {
    id: 'meals',
    label: 'Meals',
    build: (data) => [
      ['date', 'time', 'meal', 'food', 'served', 'unit', 'eaten', 'eaten %', 'preparation', 'notes'],
      ...data.meals.flatMap((meal) =>
        meal.items.length
          ? meal.items.map((item) => [meal.date, meal.time, mealLabel(meal.type), item.name, item.quantityServed, item.unit, item.quantityConsumed, consumedPercent(item), item.preparation, item.notes || meal.notes])
          : [[meal.date, meal.time, mealLabel(meal.type), meal.foods, '', '', '', '', '', meal.notes]],
      ),
    ],
  },
  {
    id: 'bowel-movements',
    label: 'Bowel movements',
    build: (data) => [
      ['date', 'time', 'bristol type', 'colour', 'amount', 'straining', 'pain', 'mucus', 'visible blood', 'notes'],
      ...data.poops.map((item) => [item.date, item.time, item.bristol, item.color, item.amount, item.straining, item.pain, item.mucus, item.visibleBlood, item.notes]),
    ],
  },
  {
    id: 'symptoms',
    label: 'Symptoms',
    build: (data) => [
      ['date', 'time', 'symptom', 'severity', 'duration (min)', 'suspected foods', 'notes'],
      ...data.symptoms.map((item) => [item.date, item.time, symptomLabel(item), item.severity, item.durationMinutes, item.reactions.map((reaction) => `${reaction.foodName} (${reaction.consumedDate} ${reaction.consumedTime})`).join('; '), item.notes]),
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    build: (data) => [
      ['date', 'weight (kg)', 'height (cm)', 'measured', 'notes'],
      ...data.growth.map((item) => [item.date, item.weightKg, item.heightCm, item.position, item.notes]),
    ],
  },
]

/** Export, backup and permanent deletion of everything in the journal. */
export function DataPanel({
  data,
  onExport,
  onDeleteAll,
  onClose,
}: {
  data: JournalData
  onExport: () => Promise<void>
  onDeleteAll: () => Promise<void>
  onClose: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const counts = [
    [data.meals.length, 'meals'],
    [data.poops.length, 'bowel movements'],
    [data.symptoms.length, 'symptoms'],
    [data.growth.length, 'growth records'],
    [data.foods.filter((food) => food.isCustom).length, 'custom foods'],
  ] as const

  return (
    <div className="form-grid data-panel">
      <p className="muted-note" style={{ margin: 0 }}>
        This journal holds {counts.map(([count, label]) => `${count} ${label}`).join(', ')}. It is stored on this journal’s server only and is never shared unless you export it.
      </p>

      <section>
        <span className="field-label">Full backup</span>
        <p className="muted-note">Everything, including photos, as one file you can import again later.</p>
        <button type="button" className="primary" onClick={() => void onExport().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not export'))}>
          Download backup (.json)
        </button>
      </section>

      <section>
        <span className="field-label">Spreadsheets</span>
        <p className="muted-note">Plain tables (CSV) for Excel, Google Sheets or your doctor.</p>
        <div className="choice-row">
          {EXPORTS.map((item) => (
            <button key={item.id} type="button" className="choice" onClick={() => download(item.id, item.build(data))}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="danger-zone">
        <span className="field-label">Delete all data</span>
        <p className="muted-note">
          Permanently removes every meal, bowel movement, symptom, check-in, growth record, photo, custom food, setting and edit history.
          Your login stays so you can start again. This cannot be undone — download a backup first if you might need it.
        </p>
        {!confirming ? (
          <button type="button" className="danger" onClick={() => setConfirming(true)}>Delete all data…</button>
        ) : (
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault()
              if (typed !== 'DELETE') return
              setBusy(true)
              try {
                await onDeleteAll()
                setMessage('All journal data was deleted.')
                setConfirming(false)
                setTyped('')
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Could not delete the data')
              } finally {
                setBusy(false)
              }
            }}
          >
            <label className="field">
              <span>Type DELETE to confirm</span>
              <input type="text" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoCapitalize="characters" />
            </label>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => { setConfirming(false); setTyped('') }}>Cancel</button>
              <button type="submit" className="danger" disabled={typed !== 'DELETE' || busy}>{busy ? 'Deleting…' : 'Delete everything'}</button>
            </div>
          </form>
        )}
      </section>

      {message && <div className="alert" role="status">{message}</div>}
      <div className="actions">
        <button type="button" className="ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
