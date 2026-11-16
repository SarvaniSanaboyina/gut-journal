import { type FormEvent, useState } from 'react'
import { changePassword } from '../api'
import { emptyBirthDateParts, joinBirthDate } from '../dates'
import { BirthDateFields } from './BirthDateFields'

export function BirthDateForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: () => void
}) {
  const [current, setCurrent] = useState(emptyBirthDateParts)
  const [birthDate, setBirthDate] = useState(emptyBirthDateParts)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const currentIso = joinBirthDate(current)
    const nextIso = joinBirthDate(birthDate)
    if (!currentIso || !nextIso) {
      setError('Enter a real date of birth')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await changePassword({ current: currentIso, birthDate: nextIso })
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not edit the date of birth')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <BirthDateFields
        id="current-birth-date"
        label="Current date of birth"
        value={current}
        onChange={(next) => {
          setError(null)
          setCurrent(next)
        }}
      />
      <BirthDateFields
        id="new-birth-date"
        label="New date of birth"
        value={birthDate}
        onChange={(next) => {
          setError(null)
          setBirthDate(next)
        }}
      />
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
