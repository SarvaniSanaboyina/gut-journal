import { type FormEvent, useState } from 'react'
import { changePassword } from '../api'
import { BIRTH_DATE_MIN } from '../constants'
import { todayISO } from '../dates'

export function BirthDateForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: () => void
}) {
  const [current, setCurrent] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const latestBirthDate = todayISO()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await changePassword({ current, birthDate })
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not edit the date of birth')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label className="field">
        <span>Current date of birth</span>
        <input
          type="date"
          name="current-birth-date"
          autoComplete="bday"
          min={BIRTH_DATE_MIN}
          max={latestBirthDate}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>New date of birth</span>
        <input
          type="date"
          name="new-birth-date"
          autoComplete="bday"
          min={BIRTH_DATE_MIN}
          max={latestBirthDate}
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          required
        />
      </label>
      {error && <p className="alert">{error}</p>}
      <div className="actions">
        <button className="ghost" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save date of birth'}
        </button>
      </div>
    </form>
  )
}
