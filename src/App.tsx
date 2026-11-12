import { useMemo, useState } from 'react'
import { HistoryView } from './components/HistoryView'
import { Chevron, LeafMark } from './components/Icons'
import { MealForm } from './components/MealForm'
import { Modal } from './components/Modal'
import { MoodForm } from './components/MoodForm'
import { PoopForm } from './components/PoopForm'
import { TodayView } from './components/TodayView'
import { WeekView } from './components/WeekView'
import { APP_NAME } from './constants'
import { formatLongDate, isToday, shiftDate, todayISO } from './dates'
import { useJournal } from './storage'
import type { MealEntry, MoodEntry, PoopEntry } from './types'

type View = 'today' | 'week' | 'history'
type Editor =
  | { kind: 'meal'; entry?: MealEntry }
  | { kind: 'poop'; entry?: PoopEntry }
  | { kind: 'mood'; entry?: MoodEntry }

async function persist(action: () => Promise<unknown>, onDone?: () => void) {
  try {
    await action()
    onDone?.()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Could not save that entry')
  }
}

export default function App() {
  const journal = useJournal()
  const [date, setDate] = useState(todayISO)
  const [view, setView] = useState<View>('today')
  const [editor, setEditor] = useState<Editor | null>(null)

  const title = useMemo(() => {
    if (isToday(date)) return 'Today'
    return formatLongDate(date)
  }, [date])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">
            <LeafMark />
          </div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>
              <span className="tagline-long">Meals, poops, and mood — saved in a local PGlite database</span>
              <span className="tagline-short">Meals, poops, and mood</span>
            </p>
          </div>
        </div>
      </header>

      {journal.status !== 'ready' && (
        <section className="status-panel">
          {journal.status === 'loading' ? (
            <>
              <h2>Opening journal</h2>
              <p>Connecting to the local PGlite database…</p>
            </>
          ) : (
            <>
              <h2>Could not open the journal</h2>
              <p>{journal.error}</p>
              <button className="add-btn" onClick={journal.reload}>Try again</button>
            </>
          )}
        </section>
      )}

      {journal.status === 'ready' && journal.saveError && (
        <div className="save-banner">{journal.saveError}</div>
      )}

      {journal.status === 'ready' && view !== 'history' && (
        <div className="date-nav">
          <button className="icon-btn" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
            <Chevron dir="left" />
          </button>
          <div className="date-nav-copy">
            <h2>{title}</h2>
            <div className="sub">
              {isToday(date) ? formatLongDate(date) : 'Tap an entry to edit it'}
              {!isToday(date) && (
                <>
                  {' · '}
                  <button className="today-chip" onClick={() => setDate(todayISO())}>
                    Jump to today
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => setDate(shiftDate(date, 1))}
            aria-label="Next day"
            disabled={date >= todayISO()}
          >
            <Chevron dir="right" />
          </button>
        </div>
      )}

      {journal.status === 'ready' && view === 'today' && (
        <TodayView
          date={date}
          data={journal.data}
          onAddMeal={() => setEditor({ kind: 'meal' })}
          onAddPoop={() => setEditor({ kind: 'poop' })}
          onAddMood={() => setEditor({ kind: 'mood' })}
          onEditMeal={(entry) => setEditor({ kind: 'meal', entry })}
          onEditPoop={(entry) => setEditor({ kind: 'poop', entry })}
          onEditMood={(entry) => setEditor({ kind: 'mood', entry })}
          onNoteChange={(note) => journal.setDayNote(date, note)}
          onNoteBlur={() => journal.flushDayNote(date)}
        />
      )}

      {journal.status === 'ready' && view === 'week' && (
        <WeekView
          date={date}
          data={journal.data}
          onSelectDate={(iso) => {
            setDate(iso)
            setView('today')
          }}
        />
      )}

      {journal.status === 'ready' && view === 'history' && (
        <HistoryView
          data={journal.data}
          onImport={journal.importBackup}
          onExport={journal.exportBackup}
          onOpenDate={(iso) => {
            setDate(iso)
            setView('today')
          }}
        />
      )}

      <nav className="tabs" hidden={Boolean(editor) || journal.status !== 'ready'}>
        <button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>
          Today
        </button>
        <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>
          Week
        </button>
        <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
          History
        </button>
      </nav>

      {editor?.kind === 'meal' && (
        <Modal
          title={editor.entry ? 'Edit meal' : 'Log a meal'}
          onClose={() => setEditor(null)}
        >
          <MealForm
            date={date}
            initial={editor.entry}
            onSave={(entry) => persist(() => journal.upsertMeal(entry), () => setEditor(null))}
            onDelete={
              editor.entry
                ? () => {
                    if (!window.confirm('Delete this meal?')) return
                    void persist(() => journal.removeMeal(editor.entry!.id), () => setEditor(null))
                  }
                : undefined
            }
            onCancel={() => setEditor(null)}
          />
        </Modal>
      )}

      {editor?.kind === 'poop' && (
        <Modal
          title={editor.entry ? 'Edit poop' : 'Log a poop'}
          onClose={() => setEditor(null)}
        >
          <PoopForm
            date={date}
            initial={editor.entry}
            onSave={(entry) => persist(() => journal.upsertPoop(entry), () => setEditor(null))}
            onDelete={
              editor.entry
                ? () => {
                    if (!window.confirm('Delete this poop log?')) return
                    void persist(() => journal.removePoop(editor.entry!.id), () => setEditor(null))
                  }
                : undefined
            }
            onCancel={() => setEditor(null)}
          />
        </Modal>
      )}

      {editor?.kind === 'mood' && (
        <Modal
          title={editor.entry ? 'Edit mood' : 'Log a mood'}
          onClose={() => setEditor(null)}
        >
          <MoodForm
            date={date}
            initial={editor.entry}
            onSave={(entry) => persist(() => journal.upsertMood(entry), () => setEditor(null))}
            onDelete={
              editor.entry
                ? () => {
                    if (!window.confirm('Delete this mood log?')) return
                    void persist(() => journal.removeMood(editor.entry!.id), () => setEditor(null))
                  }
                : undefined
            }
            onCancel={() => setEditor(null)}
          />
        </Modal>
      )}
    </div>
  )
}
