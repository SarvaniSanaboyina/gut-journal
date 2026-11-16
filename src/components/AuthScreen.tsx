import { type FormEvent, useEffect, useState } from 'react'
import type { useAuth } from '../auth'
import { BIRTH_DATE_MIN, journalTitle } from '../constants'
import { todayISO } from '../dates'

type Auth = ReturnType<typeof useAuth>

export function AuthScreen({ auth }: { auth: Auth }) {
  const setup = auth.status === 'needs-setup'
  const [name, setName] = useState(auth.accountName ?? '')
  const [birthDate, setBirthDate] = useState('')
  const title = journalTitle(setup ? name : auth.accountName)
  const latestBirthDate = todayISO()

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    if (auth.accountName && !name) setName(auth.accountName)
  }, [auth.accountName, name])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (auth.busy) return
    if (setup) {
      void auth.setup(name, birthDate)
      return
    }
    void auth.login(birthDate)
  }

  return (
    <div className="app locked">
      <header className="topbar">
        <div className="brand">
          <div className="mark">
            <img src="/favicon.png" alt="" width="46" height="46" />
          </div>
          <div>
            <h1>{title}</h1>
            <p>Family lock</p>
          </div>
        </div>
      </header>

      <form className="auth-card" onSubmit={onSubmit}>
        <h2>{setup ? 'Set a date of birth' : 'Sign in'}</h2>
        <p>
          {setup
            ? "We'll use the child's date of birth to open this journal. It stays on this computer."
            : "Enter the child's date of birth to open the journal."}
        </p>

        {setup && (
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Whose journal is this?"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
        )}

        <label className="field">
          <span>Date of birth</span>
          <input
            type="date"
            name="birthDate"
            autoComplete="bday"
            min={BIRTH_DATE_MIN}
            max={latestBirthDate}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            required
          />
        </label>

        {auth.error && <p className="alert">{auth.error}</p>}

        <div className="actions">
          <button className="primary" type="submit" disabled={auth.busy}>
            {auth.busy ? 'Please wait…' : setup ? 'Save date of birth' : 'Open journal'}
          </button>
        </div>
      </form>
    </div>
  )
}
