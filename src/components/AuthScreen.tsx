import { type FormEvent, useEffect, useState } from 'react'
import type { useAuth } from '../auth'
import { journalTitle } from '../constants'
import { emptyBirthDateParts, joinBirthDate } from '../dates'
import { BirthDateFields } from './BirthDateFields'

type Auth = ReturnType<typeof useAuth>

export function AuthScreen({ auth }: { auth: Auth }) {
  const setup = auth.status === 'needs-setup'
  const [name, setName] = useState(auth.accountName ?? '')
  const [birthDate, setBirthDate] = useState(emptyBirthDateParts)
  const [localError, setLocalError] = useState<string | null>(null)
  const childName = auth.accountName?.trim()
  const title = journalTitle(setup ? name : childName)

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    if (auth.accountName && !name) setName(auth.accountName)
  }, [auth.accountName, name])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (auth.busy) return
    const iso = joinBirthDate(birthDate)
    if (!iso) {
      setLocalError('Enter a real date of birth')
      return
    }
    setLocalError(null)
    if (setup) {
      void auth.setup(name, iso)
      return
    }
    void auth.login(iso)
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

      <form className="auth-card kid-auth" onSubmit={onSubmit}>
        <div className="auth-stickers" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <h2>{setup ? "Let's start!" : 'Hey!'}</h2>
        <p>
          {setup
            ? 'Write the name and birthday to make this journal.'
            : `Type ${childName}'s date of birth to open the journal.`}
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

        <BirthDateFields
          id="birthDate"
          value={birthDate}
          onChange={(next) => {
            setLocalError(null)
            setBirthDate(next)
          }}
        />

        {(localError || auth.error) && <p className="alert">{localError || auth.error}</p>}

        <div className="actions">
          <button className="primary" type="submit" disabled={auth.busy}>
            {auth.busy ? 'Please wait…' : setup ? 'Save and open' : "Let's go!"}
          </button>
        </div>
      </form>
    </div>
  )
}
