import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth'
import { AccountMenu } from './components/AccountMenu'
import { AuthScreen } from './components/AuthScreen'
import { HistoryView } from './components/HistoryView'
import { Chevron } from './components/Icons'
import { CheckInForm } from './components/CheckInForm'
import { FoodsManager } from './components/FoodsManager'
import { GutView } from './components/GutView'
import { NutritionView } from './components/NutritionView'
import { SymptomForm } from './components/SymptomForm'
import { MealForm } from './components/MealForm'
import { Modal } from './components/Modal'
import { MoodForm } from './components/MoodForm'
import { BirthDateForm } from './components/BirthDateForm'
import { PoopForm } from './components/PoopForm'
import { TodayView } from './components/TodayView'
import { WaterForm } from './components/WaterForm'
import { ReportsView } from './components/ReportsView'
import { journalTitle } from './constants'
import { formatLongDate, isToday, shiftDate, todayISO } from './dates'
import { useJournal } from './storage'
import type { MealEntry, MoodEntry, PoopEntry, SymptomEntry, WaterEntry } from './types'

type View = 'today' | 'gut' | 'nutrition' | 'reports' | 'history'
type Editor =
  | { kind: 'meal'; entry?: MealEntry }
  | { kind: 'poop'; entry?: PoopEntry }
  | { kind: 'mood'; entry?: MoodEntry }
  | { kind: 'water'; entry?: WaterEntry }
  | { kind: 'symptom'; entry?: SymptomEntry }
  | { kind: 'checkin' }

async function persist(action: () => Promise<unknown>, onDone?: () => void) {
  try {
    await action()
    onDone?.()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Could not save that entry')
  }
}

export default function App() {
  const auth = useAuth()
  const heading = journalTitle(auth.user?.name ?? auth.accountName)

  useEffect(() => {
    document.title = heading
  }, [heading])

  if (auth.status === 'loading' || auth.status === 'error') {
    return (
      <div className="app locked">
        <header className="topbar">
          <div className="brand">
            <div className="mark">
              <img src="/favicon.png" alt="" width="46" height="46" />
            </div>
            <div>
              <h1>{heading}</h1>
              <p>Family lock</p>
            </div>
          </div>
        </header>
        <section className="status-panel">
          {auth.status === 'loading' ? (
            <>
              <h2>Opening journal</h2>
              <p>Connecting to the local PGlite database…</p>
            </>
          ) : (
            <>
              <h2>Could not open the journal</h2>
              <p>{auth.error}</p>
              <button className="add-btn" onClick={auth.reload}>Try again</button>
            </>
          )}
        </section>
      </div>
    )
  }

  if (auth.status !== 'signed-in' || !auth.user) {
    return <AuthScreen auth={auth} />
  }

  return <JournalApp userName={auth.user.name} onSignOut={auth.signOut} />
}

function JournalApp({ userName, onSignOut }: { userName: string; onSignOut: () => Promise<void> }) {
  const journal = useJournal()
  const [date, setDate] = useState(todayISO)
  const [view, setView] = useState<View>('today')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [birthDateOpen, setBirthDateOpen] = useState(false)
  const [foodsOpen, setFoodsOpen] = useState(false)

  const title = useMemo(() => {
    if (isToday(date)) return 'Today'
    return formatLongDate(date)
  }, [date])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">
            <img src="/favicon.png" alt="" width="46" height="46" />
          </div>
          <div>
            <h1>{journalTitle(userName)}</h1>
          </div>
        </div>
        <AccountMenu
          items={[
            { label: 'History & backup', onSelect: () => setView('history') },
            { label: 'Food list', onSelect: () => setFoodsOpen(true) },
          ]}
          onChangeBirthDate={() => setBirthDateOpen(true)}
          onSignOut={() => void onSignOut()}
        />
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

      {journal.status === 'ready' && view === 'today' && (
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
          name={userName}
          data={journal.data}
          onAddMeal={() => setEditor({ kind: 'meal' })}
          onAddPoop={() => setEditor({ kind: 'poop' })}
          onAddMood={() => setEditor({ kind: 'mood' })}
          onAddWater={() => setEditor({ kind: 'water' })}
          onAddSymptom={() => setEditor({ kind: 'symptom' })}
          onCheckIn={() => setEditor({ kind: 'checkin' })}
          onEditSymptom={(entry) => setEditor({ kind: 'symptom', entry })}
          onEditMeal={(entry) => setEditor({ kind: 'meal', entry })}
          onEditPoop={(entry) => setEditor({ kind: 'poop', entry })}
          onEditMood={(entry) => setEditor({ kind: 'mood', entry })}
          onEditWater={(entry) => setEditor({ kind: 'water', entry })}
          onNoteChange={(note) => journal.setDayNote(date, note)}
          onNoteBlur={() => journal.flushDayNote(date)}
        />
      )}

      {journal.status === 'ready' && view === 'gut' && (
        <GutView
          data={journal.data}
          onAddPoop={() => setEditor({ kind: 'poop' })}
          onAddSymptom={() => setEditor({ kind: 'symptom' })}
          onEditPoop={(entry) => setEditor({ kind: 'poop', entry })}
          onEditSymptom={(entry) => setEditor({ kind: 'symptom', entry })}
        />
      )}

      {journal.status === 'ready' && view === 'nutrition' && (
        <NutritionView
          data={journal.data}
          date={date}
          onChangeDate={setDate}
          onSaveProfile={journal.saveChildProfile}
          onSaveReferences={journal.saveReferences}
        />
      )}

      {journal.status === 'ready' && view === 'reports' && (
        <ReportsView
          date={date}
          data={journal.data}
          onChangeDate={setDate}
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

      <nav className="tabs" hidden={Boolean(editor) || birthDateOpen || foodsOpen || journal.status !== 'ready'}>
        <button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>
          Diary
        </button>
        <button className={view === 'gut' ? 'active' : ''} onClick={() => setView('gut')}>
          Gut
        </button>
        <button className={view === 'nutrition' ? 'active' : ''} onClick={() => setView('nutrition')}>
          Nutrition
        </button>
        <button className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}>
          Reports
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
            meals={journal.data.meals}
            foods={journal.data.foods}
            onSaveFood={journal.upsertFood}
            onSave={(entry) => journal.upsertMeal(entry).then(() => setEditor(null))}
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
          title={editor.entry ? 'Edit bowel movement' : 'Log a bowel movement'}
          onClose={() => setEditor(null)}
        >
          <PoopForm
            date={date}
            initial={editor.entry}
            sameDay={journal.data.poops.filter((item) => item.date === date && item.id !== editor.entry?.id).length}
            onSave={(entry) => journal.upsertPoop(entry).then(() => setEditor(null))}
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

      {editor?.kind === 'water' && (
        <Modal
          title={editor.entry ? 'Edit water' : 'Log water'}
          onClose={() => setEditor(null)}
        >
          <WaterForm
            date={date}
            initial={editor.entry}
            logged={(journal.data.waters ?? []).filter((item) => item.date === date)}
            onSave={(entry) => persist(() => journal.upsertWater(entry), () => setEditor(null))}
            onDelete={
              editor.entry
                ? () => {
                    if (!window.confirm('Delete this water log?')) return
                    void persist(() => journal.removeWater(editor.entry!.id), () => setEditor(null))
                  }
                : undefined
            }
            onCancel={() => setEditor(null)}
          />
        </Modal>
      )}

      {editor?.kind === 'symptom' && (
        <Modal title={editor.entry ? 'Edit symptom' : 'Log a symptom'} onClose={() => setEditor(null)}>
          <SymptomForm
            date={date}
            initial={editor.entry}
            data={journal.data}
            onSave={async (entries) => {
              for (const entry of entries) await journal.upsertSymptom(entry)
              setEditor(null)
            }}
            onDelete={
              editor.entry
                ? () => {
                    if (!window.confirm('Delete this symptom and any suspected foods marked with it?')) return
                    void persist(() => journal.removeSymptom(editor.entry!.id), () => setEditor(null))
                  }
                : undefined
            }
            onCancel={() => setEditor(null)}
          />
        </Modal>
      )}

      {editor?.kind === 'checkin' && (
        <Modal title="Daily check-in" onClose={() => setEditor(null)}>
          <CheckInForm
            date={date}
            initial={journal.data.dailyMetrics.find((item) => item.date === date)}
            onSave={(entry) => journal.saveDailyMetric(entry).then(() => setEditor(null))}
            onCancel={() => setEditor(null)}
          />
        </Modal>
      )}

      {foodsOpen && (
        <Modal title="Food list" onClose={() => setFoodsOpen(false)}>
          <FoodsManager foods={journal.data.foods} onSave={journal.upsertFood} onDelete={journal.removeFood} />
        </Modal>
      )}

      {birthDateOpen && (
        <Modal title="Edit date of birth" onClose={() => setBirthDateOpen(false)}>
          <BirthDateForm
            onCancel={() => setBirthDateOpen(false)}
            onSaved={() => setBirthDateOpen(false)}
          />
        </Modal>
      )}
    </div>
  )
}
