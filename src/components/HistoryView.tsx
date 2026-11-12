import { useMemo, useState } from 'react'
import { bristolMeta, mealLabel, moodMeta, stoolColorMeta } from '../constants'
import { formatLongDate, formatTime } from '../dates'
import { formatConsistency, formatDuration, formatQuantity, mealDurationMinutes } from '../meals'
import { parseImportedJournal } from '../storage'
import type { JournalData } from '../types'
import { MealPhotoStrip } from './MealPhotos'

type Filter = 'all' | 'meals' | 'poops' | 'moods'

export function HistoryView({
  data,
  onImport,
  onExport,
  onOpenDate,
}: {
  data: JournalData
  onImport: (text: string) => Promise<void>
  onExport: () => Promise<void>
  onOpenDate: (iso: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const dates = useMemo(() => {
    const set = new Set<string>([
      ...data.meals.map((item) => item.date),
      ...data.poops.map((item) => item.date),
      ...data.moods.map((item) => item.date),
      ...Object.keys(data.dayNotes).filter((date) => data.dayNotes[date]?.trim()),
    ])
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [data])

  return (
    <>
      <div className="toolbar">
        {(['all', 'meals', 'poops', 'moods'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            style={filter === item ? { background: '#eef4ee', borderColor: '#3e5a4c' } : undefined}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
        <button
          onClick={() =>
            void onExport().catch((error: unknown) => {
              window.alert(error instanceof Error ? error.message : 'Could not export the backup.')
            })
          }
        >
          Export backup
        </button>
        <label>
          Import backup
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                const text = await file.text()
                try {
                  parseImportedJournal(text)
                } catch {
                  window.alert('Could not read that backup file.')
                  return
                }
                if (window.confirm('Replace the journal with the imported backup?')) {
                  await onImport(text)
                }
              } catch (error) {
                window.alert(error instanceof Error ? error.message : 'Could not import that backup.')
              }
              event.target.value = ''
            }}
          />
        </label>
      </div>

      {dates.length === 0 ? (
        <div className="empty">No journal entries yet. Start from Today.</div>
      ) : (
        dates.map((iso) => {
          const meals = filter === 'poops' || filter === 'moods' ? [] : data.meals.filter((item) => item.date === iso)
          const poops = filter === 'meals' || filter === 'moods' ? [] : data.poops.filter((item) => item.date === iso)
          const moods = filter === 'meals' || filter === 'poops' ? [] : data.moods.filter((item) => item.date === iso)
          const note = filter === 'all' ? data.dayNotes[iso] : ''
          if (!meals.length && !poops.length && !moods.length && !note?.trim()) return null

          return (
            <section className="history-day" key={iso}>
              <h4>
                <button className="history-date" onClick={() => onOpenDate(iso)}>
                  {formatLongDate(iso)}
                </button>
              </h4>
              <div className="entry-list">
                {meals.sort((a, b) => a.time.localeCompare(b.time)).map((entry) => {
                  const duration = mealDurationMinutes(entry)
                  const bits = [
                    entry.quantity != null ? formatQuantity(entry.quantity, entry.quantityUnit) : '',
                    formatConsistency(entry.consistency, entry.consistencyPercent),
                    duration != null ? formatDuration(duration) : '',
                    entry.notes,
                  ].filter(Boolean)
                  return (
                    <div className="entry meal-card" key={entry.id}>
                      <div className="entry-body">
                        <span className="badge">{mealLabel(entry.type)}</span>
                        <span>
                          <div className="title">{entry.foods}</div>
                          {bits.length > 0 && <div className="detail">{bits.join(' · ')}</div>}
                        </span>
                        <span className="meta">
                          {formatTime(entry.time)}
                          {entry.endTime ? ` – ${formatTime(entry.endTime)}` : ''}
                        </span>
                      </div>
                      <MealPhotoStrip
                        mealId={entry.id}
                        before={entry.hasBeforePhoto}
                        after={entry.hasAfterPhoto}
                      />
                    </div>
                  )
                })}
                {poops.sort((a, b) => a.time.localeCompare(b.time)).map((entry) => (
                  <div className="entry" key={entry.id}>
                    <span className="badge">Poop {entry.bristol}</span>
                    <span>
                      <div className="title">{bristolMeta(entry.bristol).title}</div>
                      <div className="detail">{stoolColorMeta(entry.color).label} · {entry.amount}</div>
                    </span>
                    <span className="meta">{formatTime(entry.time)}</span>
                  </div>
                ))}
                {moods.sort((a, b) => a.time.localeCompare(b.time)).map((entry) => (
                  <div className="entry" key={entry.id}>
                    <span className="badge">Mood</span>
                    <span>
                      <div className="title">{moodMeta(entry.mood).label}</div>
                      {entry.notes && <div className="detail">{entry.notes}</div>}
                    </span>
                    <span className="meta">{formatTime(entry.time)}</span>
                  </div>
                ))}
                {note?.trim() && (
                  <div className="entry">
                    <span className="badge">Note</span>
                    <span><div className="detail">{note}</div></span>
                    <span />
                  </div>
                )}
              </div>
            </section>
          )
        })
      )}
    </>
  )
}
